const fs=require('node:fs');

const ANALYTICS_MARKER=`/* =========================================================\n   ANALYTICS\n========================================================= */`;
const SETTINGS_BOUNDARY=`/* =========================================================\n   SETTINGS\n========================================================= */`;
const RENDER_ANALYTICS_RETIREMENT=`    ["renderAnalytics",\`/* =========================================================\\n   SETTINGS\\n========================================================= */\`],\n`;
const ALLOWED_ANALYTICS_FUNCTIONS=new Set(['renderAnalytics']);

function removeLegacyAnalyticsSource(source){
  const analyticsStart=source.indexOf(ANALYTICS_MARKER);

  if(analyticsStart<0){
    if(/\bfunction\s+renderAnalytics\s*\(/.test(source)){
      throw new Error('Legacy analytics source is malformed: ANALYTICS boundary missing.');
    }
    return source;
  }

  const settingsStart=source.indexOf(SETTINGS_BOUNDARY,analyticsStart+ANALYTICS_MARKER.length);
  if(settingsStart<0||settingsStart<=analyticsStart){
    throw new Error('Legacy analytics source is malformed: SETTINGS boundary missing.');
  }

  const block=source.slice(analyticsStart,settingsStart);
  const functionNames=[...block.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
  const rendererCount=functionNames.filter(name=>name==='renderAnalytics').length;
  if(rendererCount!==1){
    throw new Error(`Legacy analytics source is malformed: expected one renderAnalytics, found ${rendererCount}.`);
  }

  const unexpectedFunction=functionNames.find(name=>!ALLOWED_ANALYTICS_FUNCTIONS.has(name));
  if(unexpectedFunction){
    throw new Error(`Legacy analytics source contains unexpected helper ${unexpectedFunction}; refusing broad cleanup.`);
  }

  return source.slice(0,analyticsStart)+source.slice(settingsStart);
}

function removeRenderAnalyticsRetirementEntry(source){
  if(source.includes(RENDER_ANALYTICS_RETIREMENT)){
    return source.replace(RENDER_ANALYTICS_RETIREMENT,'');
  }

  const registryStart=source.indexOf('const LEGACY_RENDERER_RETIREMENT=[');
  if(registryStart<0) return source;
  const registryEnd=source.indexOf('];',registryStart);
  if(registryEnd<0) throw new Error('Legacy renderer retirement registry is malformed.');
  const registry=source.slice(registryStart,registryEnd+2);
  if(registry.includes('"renderAnalytics"')){
    throw new Error('Legacy renderAnalytics retirement entry is malformed.');
  }
  return source;
}

function run(argv=process.argv.slice(2)){
  const mode=argv[0]||'--check';
  const shellPath=argv[1]||'app-shell.html';
  const indexPath=argv[2]||'index.html';
  const shellSource=fs.readFileSync(shellPath,'utf8');
  const indexSource=fs.readFileSync(indexPath,'utf8');
  const cleanedShell=removeLegacyAnalyticsSource(shellSource);
  const cleanedIndex=removeRenderAnalyticsRetirementEntry(indexSource);
  const shellChanged=cleanedShell!==shellSource;
  const indexChanged=cleanedIndex!==indexSource;

  if(mode==='--check'){
    if(!shellChanged&&!indexChanged){
      console.log('Legacy analytics renderer and retirement entry are already removed.');
      return;
    }
    if(shellChanged!==indexChanged){
      throw new Error('Physical analytics cleanup is not atomic: shell and retirement registry are out of sync.');
    }
    console.log('Legacy analytics renderer and retirement entry can be removed atomically.');
    return;
  }

  if(mode==='--write'){
    if(shellChanged!==indexChanged){
      throw new Error('Physical analytics cleanup is not atomic: refusing partial write.');
    }
    if(shellChanged){
      fs.writeFileSync(shellPath,cleanedShell);
      fs.writeFileSync(indexPath,cleanedIndex);
    }
    console.log(shellChanged?'Legacy analytics renderer and retirement entry removed.':'No legacy analytics renderer found.');
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

if(require.main===module) run();

module.exports={ANALYTICS_MARKER,SETTINGS_BOUNDARY,RENDER_ANALYTICS_RETIREMENT,ALLOWED_ANALYTICS_FUNCTIONS,removeLegacyAnalyticsSource,removeRenderAnalyticsRetirementEntry};