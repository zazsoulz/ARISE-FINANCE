const fs=require('node:fs');

const SETTINGS_MARKER=`/* =========================================================\n   SETTINGS\n========================================================= */`;
const CATEGORY_EDITOR_BOUNDARY='function categoryEditor(category){';
const RENDER_SETTINGS_RETIREMENT='    ["renderSettings","function categoryEditor(category){"]\n';
const ALLOWED_SETTINGS_FUNCTIONS=new Set(['renderSettings']);

function removeLegacySettingsSource(source){
  const settingsStart=source.indexOf(SETTINGS_MARKER);

  if(settingsStart<0){
    if(/\bfunction\s+renderSettings\s*\(/.test(source)){
      throw new Error('Legacy settings source is malformed: SETTINGS boundary missing.');
    }
    return source;
  }

  const categoryEditorStart=source.indexOf(CATEGORY_EDITOR_BOUNDARY,settingsStart+SETTINGS_MARKER.length);
  if(categoryEditorStart<0||categoryEditorStart<=settingsStart){
    throw new Error('Legacy settings source is malformed: categoryEditor boundary missing.');
  }

  const block=source.slice(settingsStart,categoryEditorStart);
  const functionNames=[...block.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
  const rendererCount=functionNames.filter(name=>name==='renderSettings').length;
  if(rendererCount!==1){
    throw new Error(`Legacy settings source is malformed: expected one renderSettings, found ${rendererCount}.`);
  }

  const unexpectedFunction=functionNames.find(name=>!ALLOWED_SETTINGS_FUNCTIONS.has(name));
  if(unexpectedFunction){
    throw new Error(`Legacy settings source contains unexpected helper ${unexpectedFunction}; refusing broad cleanup.`);
  }

  return source.slice(0,settingsStart)+source.slice(categoryEditorStart);
}

function removeRenderSettingsRetirementEntry(source){
  if(source.includes(RENDER_SETTINGS_RETIREMENT)){
    return source.replace(RENDER_SETTINGS_RETIREMENT,'');
  }

  const registryStart=source.indexOf('const LEGACY_RENDERER_RETIREMENT=[');
  if(registryStart<0) return source;
  const registryEnd=source.indexOf('];',registryStart);
  if(registryEnd<0) throw new Error('Legacy renderer retirement registry is malformed.');
  const registry=source.slice(registryStart,registryEnd+2);
  if(registry.includes('"renderSettings"')){
    throw new Error('Legacy renderSettings retirement entry is malformed.');
  }
  return source;
}

function run(argv=process.argv.slice(2)){
  const mode=argv[0]||'--check';
  const shellPath=argv[1]||'app-shell.html';
  const indexPath=argv[2]||'index.html';
  const shellSource=fs.readFileSync(shellPath,'utf8');
  const indexSource=fs.readFileSync(indexPath,'utf8');
  const cleanedShell=removeLegacySettingsSource(shellSource);
  const cleanedIndex=removeRenderSettingsRetirementEntry(indexSource);
  const shellChanged=cleanedShell!==shellSource;
  const indexChanged=cleanedIndex!==indexSource;

  if(mode==='--check'){
    if(!shellChanged&&!indexChanged){
      console.log('Legacy settings renderer and retirement entry are already removed.');
      return;
    }
    if(shellChanged!==indexChanged){
      throw new Error('Physical settings cleanup is not atomic: shell and retirement registry are out of sync.');
    }
    console.log('Legacy settings renderer and retirement entry can be removed atomically.');
    return;
  }

  if(mode==='--write'){
    if(shellChanged!==indexChanged){
      throw new Error('Physical settings cleanup is not atomic: refusing partial write.');
    }
    if(shellChanged){
      fs.writeFileSync(shellPath,cleanedShell);
      fs.writeFileSync(indexPath,cleanedIndex);
    }
    console.log(shellChanged?'Legacy settings renderer and retirement entry removed.':'No legacy settings renderer found.');
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

if(require.main===module) run();

module.exports={SETTINGS_MARKER,CATEGORY_EDITOR_BOUNDARY,RENDER_SETTINGS_RETIREMENT,ALLOWED_SETTINGS_FUNCTIONS,removeLegacySettingsSource,removeRenderSettingsRetirementEntry};
