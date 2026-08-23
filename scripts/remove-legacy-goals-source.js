const fs=require('node:fs');

const GOALS_MARKER=`/* =========================================================\n   GOALS PAGE\n========================================================= */`;
const GOAL_MODAL_MARKER=`/* =========================================================\n   GOAL MODAL\n========================================================= */`;
const RENDER_GOALS_RETIREMENT=`    ["renderGoals",\`/* =========================================================\\n   GOAL MODAL\\n========================================================= */\`],\n`;

function removeLegacyGoalsSource(source){
  const goalsStart=source.indexOf(GOALS_MARKER);

  if(goalsStart<0){
    if(/\bfunction\s+renderGoals\s*\(/.test(source)){
      throw new Error('Legacy goals source is malformed: GOALS PAGE boundary missing.');
    }
    return source;
  }

  const modalStart=source.indexOf(GOAL_MODAL_MARKER,goalsStart+GOALS_MARKER.length);
  if(modalStart<0||modalStart<=goalsStart){
    throw new Error('Legacy goals source is malformed: GOAL MODAL boundary missing.');
  }

  const block=source.slice(goalsStart,modalStart);
  const functionNames=[...block.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
  const rendererCount=functionNames.filter(name=>name==='renderGoals').length;
  if(rendererCount!==1){
    throw new Error(`Legacy goals source is malformed: expected one renderGoals, found ${rendererCount}.`);
  }

  const unexpectedFunction=functionNames.find(name=>name!=='renderGoals');
  if(unexpectedFunction){
    throw new Error(`Legacy goals source contains unexpected helper ${unexpectedFunction}; refusing broad cleanup.`);
  }

  return source.slice(0,goalsStart)+source.slice(modalStart);
}

function removeRenderGoalsRetirementEntry(source){
  if(source.includes(RENDER_GOALS_RETIREMENT)){
    return source.replace(RENDER_GOALS_RETIREMENT,'');
  }

  const registryStart=source.indexOf('const LEGACY_RENDERER_RETIREMENT=[');
  if(registryStart<0) return source;
  const registryEnd=source.indexOf('];',registryStart);
  if(registryEnd<0) throw new Error('Legacy renderer retirement registry is malformed.');
  const registry=source.slice(registryStart,registryEnd+2);
  if(registry.includes('"renderGoals"')){
    throw new Error('Legacy renderGoals retirement entry is malformed.');
  }
  return source;
}

function run(argv=process.argv.slice(2)){
  const mode=argv[0]||'--check';
  const shellPath=argv[1]||'app-shell.html';
  const indexPath=argv[2]||'index.html';
  const shellSource=fs.readFileSync(shellPath,'utf8');
  const indexSource=fs.readFileSync(indexPath,'utf8');
  const cleanedShell=removeLegacyGoalsSource(shellSource);
  const cleanedIndex=removeRenderGoalsRetirementEntry(indexSource);
  const shellChanged=cleanedShell!==shellSource;
  const indexChanged=cleanedIndex!==indexSource;

  if(mode==='--check'){
    if(!shellChanged&&!indexChanged){
      console.log('Legacy goals renderer and retirement entry are already removed.');
      return;
    }
    if(shellChanged!==indexChanged){
      throw new Error('Physical goals cleanup is not atomic: shell and retirement registry are out of sync.');
    }
    console.log('Legacy goals renderer and retirement entry can be removed atomically.');
    return;
  }

  if(mode==='--write'){
    if(shellChanged!==indexChanged){
      throw new Error('Physical goals cleanup is not atomic: refusing partial write.');
    }
    if(shellChanged){
      fs.writeFileSync(shellPath,cleanedShell);
      fs.writeFileSync(indexPath,cleanedIndex);
    }
    console.log(shellChanged?'Legacy goals renderer and retirement entry removed.':'No legacy goals renderer found.');
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

if(require.main===module) run();

module.exports={GOALS_MARKER,GOAL_MODAL_MARKER,RENDER_GOALS_RETIREMENT,removeLegacyGoalsSource,removeRenderGoalsRetirementEntry};