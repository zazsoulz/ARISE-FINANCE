const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const {extractManifest}=require('../scripts/build-standalone-preview.js');
const {removeHistoryTransactionSource}=require('../scripts/remove-history-transaction-source.js');

const originalShell=fs.readFileSync('app-shell.html','utf8');
const shell=removeHistoryTransactionSource(originalShell);
const index=fs.readFileSync('index.html','utf8');
const financialMarker=`/* =========================================================\n   FINANCIAL ENGINE\n========================================================= */`;
const uiMarker=`/* =========================================================\n   UI\n========================================================= */`;
const initMarker=`/* =========================================================\n   INITIALIZATION\n========================================================= */`;

function effectiveShellScript(){
  const scripts=[...shell.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length,1,'expected one inline shell script after historyTransaction cleanup');
  let source=scripts[0][1];
  const financialStart=source.indexOf(financialMarker);
  const uiStart=source.indexOf(uiMarker);
  assert.ok(financialStart>=0&&uiStart>financialStart,'financial/UI boundaries must survive cleanup');
  source=source.slice(0,financialStart)+source.slice(uiStart);
  const initStart=source.indexOf(initMarker);
  assert.ok(initStart>=0,'initialization boundary must survive cleanup');
  return source.slice(0,initStart);
}

function execute(context,source,filename='inline.js'){
  return new vm.Script(source,{filename}).runInContext(context);
}

async function bootCleanedShell(){
  const dom=new JSDOM(shell,{url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom;
  window.alert=()=>{};
  window.confirm=()=>true;
  const context=dom.getInternalVMContext();

  execute(context,effectiveShellScript(),'app-shell-history-cleaned-effective.js');
  execute(context,`globalThis.__ARISE_LEGACY_FINANCIAL_STRIPPED__=true; state.account.registered=true; state.account.name='QA'; state.account.email='qa@example.com'; saveState();`,'seed-state.js');

  const manifest=extractManifest(index);
  for(const source of manifest.scripts){
    if(/^https?:\/\//i.test(source))continue;
    const path=source.replace(/^\.\//,'');
    const result=execute(context,fs.readFileSync(path,'utf8'),path);
    if(result&&typeof result.then==='function')await result;
  }

  return {dom,context,manifest};
}

test('historyTransaction cleanup leaves canonical production runtime bootable',async()=>{
  assert.notEqual(shell,originalShell,'current shell should still contain the legacy historyTransaction source before physical cleanup');
  assert.equal(removeHistoryTransactionSource(shell),shell,'cleanup must be idempotent after in-memory removal');
  assert.doesNotMatch(shell,/\bfunction\s+historyTransaction\s*\(/,'legacy historyTransaction source survived transform');
  assert.match(shell,/\bfunction\s+categoryEditor\s*\(/,'categoryEditor boundary must survive transform');

  const {dom,context,manifest}=await bootCleanedShell();
  assert.ok(manifest.scripts.includes('./history-inspector.js'),'canonical historyTransaction owner missing from production manifest');
  assert.equal(execute(context,'typeof ARISE_HISTORY_INSPECTOR?.historyTransaction','history-owner-export.js'),'function');
  assert.equal(execute(context,'typeof historyTransaction','history-runtime-row.js'),'function');
  dom.window.close();
});

test('canonical history rows still render income and expense details after legacy source removal',async()=>{
  const {dom,context}=await bootCleanedShell();

  const incomeHTML=execute(context,`historyTransaction({
    type:'income',amount:100000,currency:'RUB',source:'Работа',date:'2026-08-24',reserve:10000,
    allocations:[{name:'На жизнь',amount:60000},{name:'Творчество',amount:30000}]
  })`,'history-income-row.js');
  assert.match(incomeHTML,/\+ 100/);
  assert.match(incomeHTML,/Работа/);
  assert.match(incomeHTML,/На жизнь/);
  assert.match(incomeHTML,/РЕЗЕРВ/);

  const expenseHTML=execute(context,`historyTransaction({
    type:'expense',amount:5000,currency:'RUB',categoryName:'На жизнь',source:'Продукты',date:'2026-08-24'
  })`,'history-expense-row.js');
  assert.match(expenseHTML,/- 5/);
  assert.match(expenseHTML,/На жизнь/);
  assert.match(expenseHTML,/Продукты/);
  assert.match(expenseHTML,/Расход/);

  dom.window.close();
});
