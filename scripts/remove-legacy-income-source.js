const fs=require('node:fs');

const INCOME_MARKER=`/* =========================================================\n   INCOME PAGE\n========================================================= */`;
const INCOME_ROW_MARKER='function incomeRow(tx){';
const RENDER_INCOME_RETIREMENT=`    ["renderIncome","function incomeRow(tx){"],\n`;

function removeLegacyIncomeSource(source){
  const markerStart=source.indexOf(INCOME_MARKER);
  const rendererStart=source.indexOf('function renderIncome(){',markerStart>=0?markerStart:0);

  if(markerStart<0||rendererStart<0){
    if(/\bfunction\s+renderIncome\s*\(/.test(source)){
      throw new Error('Legacy income source is malformed: INCOME PAGE boundary missing.');
    }
    return source;
  }

  if(rendererStart<markerStart){
    throw new Error('Legacy income source is malformed: renderIncome precedes INCOME PAGE boundary.');
  }

  const incomeRowStart=source.indexOf(INCOME_ROW_MARKER,rendererStart+'function renderIncome(){'.length);
  if(incomeRowStart<0||incomeRowStart<=rendererStart){
    throw new Error('Legacy income source is malformed: incomeRow boundary missing.');
  }

  const block=source.slice(rendererStart,incomeRowStart);
  const functionNames=[...block.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
  const rendererCount=functionNames.filter(name=>name==='renderIncome').length;
  if(rendererCount!==1){
    throw new Error(`Legacy income source is malformed: expected one renderIncome, found ${rendererCount}.`);
  }

  const unexpectedFunction=functionNames.find(name=>name!=='renderIncome');
  if(unexpectedFunction){
    throw new Error(`Legacy income source contains unexpected helper ${unexpectedFunction}; refusing broad cleanup.`);
  }

  return source.slice(0,markerStart)+source.slice(incomeRowStart);
}

function removeRenderIncomeRetirementEntry(source){
  if(source.includes(RENDER_INCOME_RETIREMENT)){
    return source.replace(RENDER_INCOME_RETIREMENT,'');
  }

  const registryStart=source.indexOf('const LEGACY_RENDERER_RETIREMENT=[');
  if(registryStart<0) return source;
  const registryEnd=source.indexOf('];',registryStart);
  if(registryEnd<0){
    throw new Error('Legacy renderer retirement registry is malformed.');
  }
  const registry=source.slice(registryStart,registryEnd+2);
  if(registry.includes('"renderIncome"')){
    throw new Error('Legacy renderIncome retirement entry is malformed.');
  }

  return source;
}

function run(argv=process.argv.slice(2)){
  const mode=argv[0]||'--check';
  const shellPath=argv[1]||'app-shell.html';
  const indexPath=argv[2]||'index.html';
  const shellSource=fs.readFileSync(shellPath,'utf8');
  const indexSource=fs.readFileSync(indexPath,'utf8');
  const cleanedShell=removeLegacyIncomeSource(shellSource);
  const cleanedIndex=removeRenderIncomeRetirementEntry(indexSource);
  const shellChanged=cleanedShell!==shellSource;
  const indexChanged=cleanedIndex!==indexSource;

  if(mode==='--check'){
    if(!shellChanged&&!indexChanged){
      console.log('Legacy income renderer and retirement entry are already removed.');
      return;
    }
    if(shellChanged!==indexChanged){
      throw new Error('Physical income cleanup is not atomic: shell and retirement registry are out of sync.');
    }
    console.log('Legacy income renderer and retirement entry can be removed atomically.');
    return;
  }

  if(mode==='--write'){
    if(shellChanged!==indexChanged){
      throw new Error('Physical income cleanup is not atomic: refusing partial write.');
    }
    if(shellChanged){
      fs.writeFileSync(shellPath,cleanedShell);
      fs.writeFileSync(indexPath,cleanedIndex);
    }
    console.log(shellChanged?'Legacy income renderer and retirement entry removed.':'No legacy income renderer found.');
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

if(require.main===module){
  run();
}

module.exports={INCOME_MARKER,INCOME_ROW_MARKER,RENDER_INCOME_RETIREMENT,removeLegacyIncomeSource,removeRenderIncomeRetirementEntry};
