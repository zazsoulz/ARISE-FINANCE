const fs=require('node:fs');

const HOME_MARKER=`/* =========================================================\n   HOME\n========================================================= */`;
const GOAL_CARD_MARKER=`/* =========================================================\n   GOAL CARD\n========================================================= */`;
const RENDER_HOME_RETIREMENT=`    ["renderHome",\`/* =========================================================\\n   GOAL CARD\\n========================================================= */\`],\n`;

function removeLegacyHomeSource(source){
  const homeStart=source.indexOf(HOME_MARKER);

  if(homeStart<0){
    if(/\bfunction\s+renderHome\s*\(/.test(source)){
      throw new Error('Legacy home source is malformed: HOME boundary missing.');
    }
    return source;
  }

  const goalCardStart=source.indexOf(GOAL_CARD_MARKER,homeStart+HOME_MARKER.length);
  if(goalCardStart<0||goalCardStart<=homeStart){
    throw new Error('Legacy home source is malformed: GOAL CARD boundary missing.');
  }

  const block=source.slice(homeStart,goalCardStart);
  const functionNames=[...block.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
  const rendererCount=functionNames.filter(name=>name==='renderHome').length;
  if(rendererCount!==1){
    throw new Error(`Legacy home source is malformed: expected one renderHome, found ${rendererCount}.`);
  }

  const unexpectedFunction=functionNames.find(name=>name!=='renderHome');
  if(unexpectedFunction){
    throw new Error(`Legacy home source contains unexpected helper ${unexpectedFunction}; refusing broad cleanup.`);
  }

  return source.slice(0,homeStart)+source.slice(goalCardStart);
}

function removeRenderHomeRetirementEntry(source){
  if(source.includes(RENDER_HOME_RETIREMENT)){
    return source.replace(RENDER_HOME_RETIREMENT,'');
  }

  const registryStart=source.indexOf('const LEGACY_RENDERER_RETIREMENT=[');
  if(registryStart<0) return source;
  const registryEnd=source.indexOf('];',registryStart);
  if(registryEnd<0){
    throw new Error('Legacy renderer retirement registry is malformed.');
  }
  const registry=source.slice(registryStart,registryEnd+2);
  if(registry.includes('"renderHome"')){
    throw new Error('Legacy renderHome retirement entry is malformed.');
  }

  return source;
}

function run(argv=process.argv.slice(2)){
  const mode=argv[0]||'--check';
  const shellPath=argv[1]||'app-shell.html';
  const indexPath=argv[2]||'index.html';
  const shellSource=fs.readFileSync(shellPath,'utf8');
  const indexSource=fs.readFileSync(indexPath,'utf8');
  const cleanedShell=removeLegacyHomeSource(shellSource);
  const cleanedIndex=removeRenderHomeRetirementEntry(indexSource);
  const shellChanged=cleanedShell!==shellSource;
  const indexChanged=cleanedIndex!==indexSource;

  if(mode==='--check'){
    if(!shellChanged&&!indexChanged){
      console.log('Legacy home source and retirement entry are already removed.');
      return;
    }
    if(shellChanged!==indexChanged){
      throw new Error('Physical home cleanup is not atomic: shell and retirement registry are out of sync.');
    }
    console.log('Legacy home source and retirement entry can be removed atomically.');
    return;
  }

  if(mode==='--write'){
    if(shellChanged!==indexChanged){
      throw new Error('Physical home cleanup is not atomic: refusing partial write.');
    }
    if(shellChanged){
      fs.writeFileSync(shellPath,cleanedShell);
      fs.writeFileSync(indexPath,cleanedIndex);
    }
    console.log(shellChanged?'Legacy home source and retirement entry removed.':'No legacy home source found.');
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

if(require.main===module){
  run();
}

module.exports={HOME_MARKER,GOAL_CARD_MARKER,RENDER_HOME_RETIREMENT,removeLegacyHomeSource,removeRenderHomeRetirementEntry};
