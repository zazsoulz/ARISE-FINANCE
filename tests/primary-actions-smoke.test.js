const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

const shell=fs.readFileSync('app-shell.html','utf8');
const financialMarker=`/* =========================================================\n   FINANCIAL ENGINE\n========================================================= */`;
const uiMarker=`/* =========================================================\n   UI\n========================================================= */`;
const initMarker=`/* =========================================================\n   INITIALIZATION\n========================================================= */`;

function shellRuntime(){
  const match=shell.match(/<script>([\s\S]*?)<\/script>/i);
  let source=match[1];
  const financialStart=source.indexOf(financialMarker),uiStart=source.indexOf(uiMarker);
  source=source.slice(0,financialStart)+source.slice(uiStart);
  return source.slice(0,source.indexOf(initMarker));
}
function run(ctx,source,name='inline.js'){return new vm.Script(source,{filename:name}).runInContext(ctx);}
function file(ctx,path){return run(ctx,fs.readFileSync(path,'utf8'),path);}
function boot(){
  const dom=new JSDOM(shell,{url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true});
  dom.window.alert=()=>{}; dom.window.confirm=()=>true;
  const ctx=dom.getInternalVMContext();
  run(ctx,shellRuntime(),'app-shell-effective.js');
  run(ctx,`state.account.registered=true; state.account.name='QA'; saveState();`,'seed.js');
  for(const path of [
    'financial-core.js','goal-lifecycle-core.js','reserve-lifecycle-core.js','goal-future-reroute-core.js',
    'expense-reconciliation.js','financial-runtime.js','goal-history.js','financial-integration.js',
    'reserve-analytics.js','reserve-essential-spend.js','analytics-engine.js','product-rules.js','navigation-compat.js','arise-v3.js',
    'history-inspector.js','analytics-ui.js','expense-edit-ui.js',
    'account-settings.js','profile-lifecycle.js','settings-ui.js','product-ui.js','reserve-lifecycle-ui.js'
  ]) file(ctx,path);
  run(ctx,'render();','render.js');
  return {dom,ctx,document:dom.window.document};
}

test('production navigation exposes five primary sections and every button changes screen',()=>{
  const {dom,document}=boot();
  const expected=['home','income','goals','history','analytics'];
  assert.deepEqual([...document.querySelectorAll('.product-nav [data-page]')].map(x=>x.dataset.page),expected);
  const selectors={home:'.arise-v3-home',income:'.arise-v3-distribution',goals:'.arise-v3-goals',history:'.arise-v3-history',analytics:'.arise-analytics'};
  for(const page of expected){
    document.querySelector(`.product-nav [data-page="${page}"]`).click();
    assert.ok(document.querySelector(selectors[page]),`${page} did not render its primary screen`);
  }
  dom.window.close();
});

test('home quick income and expense actions open the real transaction sheets',()=>{
  const {dom,ctx,document}=boot();
  const income=document.querySelector('[data-quick-income]');
  const expense=document.querySelector('[data-quick-expense]');
  assert.ok(income&&expense,'home quick actions missing');
  income.click();
  assert.ok(document.getElementById('incomeAmount'),'income sheet did not open');
  run(ctx,'closeModal();','close-income.js');
  expense.click();
  assert.ok(document.getElementById('expenseAmount'),'expense sheet did not open');
  dom.window.close();
});

test('history primary income and expense actions remain live after product UI decoration',()=>{
  const {dom,ctx,document}=boot();
  run(ctx,`activePage='history'; render();`,'history.js');
  const income=document.getElementById('historyIncome');
  const expense=document.getElementById('historyExpense');
  assert.ok(income&&expense);
  income.click();
  assert.ok(document.getElementById('incomeAmount'),'history income action is dead');
  run(ctx,'closeModal(); activePage="history"; render();','history-again.js');
  document.getElementById('historyExpense').click();
  assert.ok(document.getElementById('expenseAmount'),'history expense action is dead');
  dom.window.close();
});

test('distribution primary actions open income entry and route to settings',()=>{
  const {dom,ctx,document}=boot();
  run(ctx,`activePage='income'; render();`,'income-screen.js');
  const addIncome=document.getElementById('incomeStart');
  const settings=document.getElementById('incomeSettings');
  assert.ok(addIncome&&settings,'distribution primary actions missing');
  addIncome.click();
  assert.ok(document.getElementById('incomeAmount'),'distribution add-income action is dead');
  run(ctx,'closeModal(); activePage="income"; render();','income-screen-again.js');
  document.getElementById('incomeSettings').click();
  assert.equal(run(ctx,'activePage','read-active-page.js'),'settings');
  assert.ok(document.getElementById('settingsProfileName'),'distribution settings action did not render settings');
  dom.window.close();
});

test('goals primary create action opens the canonical goal sheet',()=>{
  const {dom,ctx,document}=boot();
  run(ctx,`activePage='goals'; render();`,'goals-screen.js');
  const create=document.getElementById('createGoal');
  assert.ok(create,'goal create action missing');
  create.click();
  assert.ok(document.getElementById('goalName'),'goal create action is dead');
  assert.ok(document.getElementById('goalTarget'),'goal sheet is missing target input');
  dom.window.close();
});

test('profile control routes to account and financial settings instead of a dead surface',()=>{
  const {dom,ctx,document}=boot();
  const profile=document.querySelector('.avatar[data-page="settings"]');
  assert.ok(profile,'profile settings control missing');
  profile.click();
  assert.equal(run(ctx,'activePage','profile-active-page.js'),'settings');
  assert.ok(document.getElementById('settingsProfileName'),'profile control did not open financial settings');
  dom.window.close();
});

test('reserve lifecycle primary controls open real deposit flow and persist settings',()=>{
  const {dom,ctx,document}=boot();
  run(ctx,`activePage='settings'; render();`,'reserve-settings.js');
  const section=document.getElementById('reserveLifecycle');
  assert.ok(section,'reserve lifecycle section missing from settings');
  const deposit=document.getElementById('reserveDepositAction');
  const save=document.getElementById('saveReserveLifecycleSettings');
  assert.ok(deposit&&save,'reserve lifecycle primary controls missing');
  deposit.click();
  assert.ok(document.getElementById('reserveDepositAmount'),'reserve deposit action is dead');
  run(ctx,'closeModal(); activePage="settings"; render();','reserve-settings-again.js');
  document.getElementById('reserveTargetBalance').value='300000';
  document.getElementById('reserveEssentialSpend').value='60000';
  document.getElementById('saveReserveLifecycleSettings').click();
  const saved=run(ctx,'(()=>{const r=activeProfile().settings.reserve||{}; return {targetBalance:r.targetBalance,monthlyEssentialSpend:r.monthlyEssentialSpend};})()','reserve-saved.js');
  assert.deepEqual({...saved},{targetBalance:300000,monthlyEssentialSpend:60000});
  dom.window.close();
});