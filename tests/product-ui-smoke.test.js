const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function boot(){
  const dom=new JSDOM('<!doctype html><div id="page"></div>');
  let incomeCalls=0,expenseCalls=0;
  const ctx={
    console,document:dom.window.document,navigator:{onLine:true},window:null,globalThis:null,
    activePage:'home',state:{account:{name:'Заур',avatar:''}},activeProfile:()=>({name:'Основной'}),
    escapeHTML:value=>String(value??''),
    showIncomeModal:()=>{incomeCalls++;},showExpenseModal:()=>{expenseCalls++;},
    renderHome:()=>{dom.window.document.getElementById('page').innerHTML='<main class="arise-v3-home"><section class="arise-v3-income"></section></main>';},
    renderHistory:()=>{dom.window.document.getElementById('page').innerHTML='<button id="historyIncome">Доход</button><button id="historyExpense">Расход</button>';}
  };
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('product-ui.js','utf8'),ctx,{filename:'product-ui.js'});
  return {ctx,dom,calls:()=>({incomeCalls,expenseCalls})};
}

test('final product navigation contains five icon-backed destinations',()=>{
  const {ctx}=boot();
  const html=ctx.renderNav();
  assert.equal((html.match(/product-nav-item/g)||[]).length,5);
  assert.equal((html.match(/<svg/g)||[]).length,5);
  for(const page of ['home','income','goals','history','analytics'])assert.ok(html.includes(`data-page="${page}"`));
});

test('home exposes working income and expense quick actions',()=>{
  const {ctx,dom,calls}=boot();ctx.renderHome();
  const income=dom.window.document.querySelector('[data-quick-income]');
  const expense=dom.window.document.querySelector('[data-quick-expense]');
  assert.ok(income);assert.ok(expense);
  income.click();expense.click();
  assert.deepEqual(calls(),{incomeCalls:1,expenseCalls:1});
});

test('topbar exposes profile identity and live connection state',()=>{
  const {ctx}=boot();const html=ctx.renderTopbar();
  assert.match(html,/ARISE/);assert.match(html,/Основной/);assert.match(html,/Онлайн/);assert.match(html,/data-page="settings"/);
});

test('topbar shows synchronization while sync engine is busy',()=>{
  const {ctx}=boot();
  ctx.ARISE_SYNC={lastResult:()=>({status:'busy'})};
  const html=ctx.renderTopbar();
  assert.match(html,/Синхронизация/);
  assert.match(html,/product-sync syncing/);
});

test('history decoration preserves an existing wrapped history renderer',()=>{
  const {ctx,dom}=boot();
  ctx.renderHistory();
  assert.ok(dom.window.document.querySelector('#historyIncome svg'));
  assert.ok(dom.window.document.querySelector('#historyExpense svg'));
});
