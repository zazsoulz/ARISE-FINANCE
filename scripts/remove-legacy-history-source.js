const fs=require('node:fs');

const HISTORY_MARKER=`/* =========================================================\n   HISTORY\n========================================================= */`;
const HISTORY_TRANSACTION_BOUNDARY='function historyTransaction(tx){';
const RENDER_HISTORY_RETIREMENT=`    ["renderHistory","function historyTransaction(tx){"],\n`;
const ALLOWED_HISTORY_FUNCTIONS=new Set(['renderHistory','historyMonthBlock']);

function removeLegacyHistorySource(source){
  const historyStart=source.indexOf(HISTORY_MARKER);

  if(historyStart<0){
    if(/\bfunction\s+renderHistory\s*\(/.test(source)){
      throw new Error('Legacy history source is malformed: HISTORY boundary missing.');
    }
    return source;
  }

  const transactionStart=source.indexOf(HISTORY_TRANSACTION_BOUNDARY,historyStart+HISTORY_MARKER.length);
  if(transactionStart<0||transactionStart<=historyStart){
    throw new Error('Legacy history source is malformed: historyTransaction boundary missing.');
  }

  const block=source.slice(historyStart,transactionStart);
  const functionNames=[...block.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
  const rendererCount=functionNames.filter(name=>name==='renderHistory').length;
  if(rendererCount!==1){
    throw new Error(`Legacy history source is malformed: expected one renderHistory, found ${rendererCount}.`);
  }

  const unexpectedFunction=functionNames.find(name=>!ALLOWED_HISTORY_FUNCTIONS.has(name));
  if(unexpectedFunction){
    throw new Error(`Legacy history source contains unexpected helper ${unexpectedFunction}; refusing broad cleanup.`);
  }

  return source.slice(0,historyStart)+source.slice(transactionStart);
}

function removeRenderHistoryRetirementEntry(source){
  if(source.includes(RENDER_HISTORY_RETIREMENT)){
    return source.replace(RENDER_HISTORY_RETIREMENT,'');
  }

  const registryStart=source.indexOf('const LEGACY_RENDERER_RETIREMENT=[');
  if(registryStart<0) return source;
  const registryEnd=source.indexOf('];',registryStart);
  if(registryEnd<0) throw new Error('Legacy renderer retirement registry is malformed.');
  const registry=source.slice(registryStart,registryEnd+2);
  if(registry.includes('"renderHistory"')){
    throw new Error('Legacy renderHistory retirement entry is malformed.');
  }
  return source;
}

function run(argv=process.argv.slice(2)){
  const mode=argv[0]||'--check';
  const shellPath=argv[1]||'app-shell.html';
  const indexPath=argv[2]||'index.html';
  const shellSource=fs.readFileSync(shellPath,'utf8');
  const indexSource=fs.readFileSync(indexPath,'utf8');
  const cleanedShell=removeLegacyHistorySource(shellSource);
  const cleanedIndex=removeRenderHistoryRetirementEntry(indexSource);
  const shellChanged=cleanedShell!==shellSource;
  const indexChanged=cleanedIndex!==indexSource;

  if(mode==='--check'){
    if(!shellChanged&&!indexChanged){
      console.log('Legacy history renderer and retirement entry are already removed.');
      return;
    }
    if(shellChanged!==indexChanged){
      throw new Error('Physical history cleanup is not atomic: shell and retirement registry are out of sync.');
    }
    console.log('Legacy history renderer and retirement entry can be removed atomically.');
    return;
  }

  if(mode==='--write'){
    if(shellChanged!==indexChanged){
      throw new Error('Physical history cleanup is not atomic: refusing partial write.');
    }
    if(shellChanged){
      fs.writeFileSync(shellPath,cleanedShell);
      fs.writeFileSync(indexPath,cleanedIndex);
    }
    console.log(shellChanged?'Legacy history renderer and retirement entry removed.':'No legacy history renderer found.');
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

if(require.main===module) run();

module.exports={HISTORY_MARKER,HISTORY_TRANSACTION_BOUNDARY,RENDER_HISTORY_RETIREMENT,ALLOWED_HISTORY_FUNCTIONS,removeLegacyHistorySource,removeRenderHistoryRetirementEntry};