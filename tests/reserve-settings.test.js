const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

const shell=fs.readFileSync('app-shell.html','utf8');
const financialMarker=`/* =========================================================\n   FINANCIAL ENGINE\n========================================================= */`;
const uiMarker=`/* =========================================================\n   UI\n========================================================= */`;
const initMarker=`/* =========================================================\n   INITIALIZATION\n========================================================= */`;

function effectiveShellScript(){
  const scripts=[...shell.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  let source=scripts[0][1];
  const financialStart=source.indexOf(financialMarker);
  const uiStart=source.indexOf(uiMarker);
  source=source.slice(0,financialStart)+source.slice(uiStart);
  const initStart=source.indexOf(initMarker);
  return source.slice(0,initStart);
}
function execute(context,source,filename='inline.js'){return new vm.Script(source,{filename}).runInContext(context);}
function executeFile(context,path){return execute(context,fs.readFileSync(path,'utf8'),path);}
function boot(){
  const dom=new JSDOM(shell,{url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom; window.alert=()=>{}; window.confirm=()=>true;
  const context=dom.getInternalVMContext();
  execute(context,effectiveShellScript(),'app-shell-effective.js');
  execute(context,`state.account.registered=true; state.account.name='QA'; state.account.email='qa@example.com'; saveState();`,'seed-state.js');
  for(const path of ['financial-core.js','financial-runtime.js','financial-integration.js','reserve-analytics.js','product-rules.js','arise-v3.js','analytics-engine.js','analytics-ui.js','settings-ui.js','financial-bootstrap.js']) executeFile(context,path);
  return {dom,context};
}

test('reserve target is editable and persists per financial profile',()=>{
  const {dom,context}=boot();
  execute(context,`activePage='settings'; render();`,'open-settings.js');
  const document=dom.window.document;
  const input=document.getElementById('reserveTargetBalance');
  assert.ok(input,'reserve target input missing');
  assert.ok(document.getElementById('reserveTargetStatus'),'reserve target status missing');
  input.value='300000';
  document.getElementById('saveReserve').click();
  assert.equal(execute(context,'activeProfile().settings.reserve.targetBalance','read-target.js'),300000);
  execute(context,`activePage='settings'; render();`,'reopen-settings.js');
  assert.equal(document.getElementById('reserveTargetBalance').value,'300000');
  dom.window.close();
});

test('reserve target progress is derived from ledger balance, not a mutable current counter',()=>{
  const {dom,context}=boot();
  execute(context,`(()=>{const p=activeProfile(); p.settings.reserve.targetBalance=1000; p.transactions=[{id:'i1',type:'income',date:'2026-08-19',month:'2026-08',amount:500,currency:'RUB',allocations:[],goalAllocations:[],reserve:400,remainder:100}]; activePage='settings'; render();})()`,'seed-reserve.js');
  const text=dom.window.document.getElementById('reserveTargetStatus').textContent.replace(/\s+/g,' ').trim();
  assert.match(text,/400/);
  assert.match(text,/1\s?000/);
  assert.match(text,/40%/);
  assert.match(text,/600/);
  dom.window.close();
});
