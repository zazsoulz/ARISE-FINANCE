const fs=require('node:fs');

const HISTORY_TRANSACTION_BOUNDARY='function historyTransaction(tx){';
const CATEGORY_EDITOR_BOUNDARY='function categoryEditor(category){';

function removeHistoryTransactionSource(source){
  const start=source.indexOf(HISTORY_TRANSACTION_BOUNDARY);

  if(start<0){
    if(/\bfunction\s+historyTransaction\s*\(/.test(source)){
      throw new Error('History transaction source is malformed: historyTransaction remains without canonical boundary.');
    }
    return source;
  }

  const end=source.indexOf(CATEGORY_EDITOR_BOUNDARY,start+HISTORY_TRANSACTION_BOUNDARY.length);
  if(end<0||end<=start){
    throw new Error('History transaction source is malformed: categoryEditor boundary missing.');
  }

  const block=source.slice(start,end);
  const names=[...block.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
  const historyCount=names.filter(name=>name==='historyTransaction').length;
  if(historyCount!==1){
    throw new Error(`History transaction source is malformed: expected one historyTransaction, found ${historyCount}.`);
  }

  const unexpected=names.find(name=>name!=='historyTransaction');
  if(unexpected){
    throw new Error(`History transaction source contains unexpected helper ${unexpected}; refusing broad cleanup.`);
  }

  return source.slice(0,start)+source.slice(end);
}

function run(argv=process.argv.slice(2)){
  const mode=argv[0]||'--check';
  const shellPath=argv[1]||'app-shell.html';
  const source=fs.readFileSync(shellPath,'utf8');
  const cleaned=removeHistoryTransactionSource(source);
  const changed=cleaned!==source;

  if(mode==='--check'){
    console.log(changed
      ? 'Legacy historyTransaction source can be removed safely.'
      : 'Legacy historyTransaction source is already removed.');
    return;
  }

  if(mode==='--write'){
    if(changed)fs.writeFileSync(shellPath,cleaned);
    console.log(changed
      ? 'Legacy historyTransaction source removed.'
      : 'No legacy historyTransaction source found.');
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

if(require.main===module)run();

module.exports={HISTORY_TRANSACTION_BOUNDARY,CATEGORY_EDITOR_BOUNDARY,removeHistoryTransactionSource};
