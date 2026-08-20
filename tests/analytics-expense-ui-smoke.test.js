const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function boot(){
  const dom=new JSDOM('<!doctype html><div id="page"></div>');
  const profile={settings:{currency:'RUB',reserve:{target:100000}},transactions:[],goals:[]};
  const ctx={console,document:dom.window.document,window:null,globalThis:null,activeMonth:'2026-08',activePage:'analytics',activeProfile:()=>profile,renderNav:()=>'<nav></nav>',money:v=>`${Math.round(Number(v)||0)} ₽`,formatMonth:k=>k,formatDate:v=>v,escapeHTML:v=>String(v??''),ARISE_FINANCE_CORE:{reserveBalance:()=>30000},ARISE_ANALYTICS:{
    months:()=>['2026-08'],monthly:()=>({income:100000,expenses:30000,freeEnd:70000,uncontrolled:0,incomeCount:1}),compare:()=>null,
    series:()=>[{month:'2026-08',income:100000,expenses:30000}],incomeSources:()=>[{name:'Работа',value:100000,share:1}],goals:()=>[],
    expenseComposition:()=>[{name:'Жизнь',value:20000,share:2/3},{name:'Кафе',value:10000,share:1/3}],
    lifetime:()=>({months:1,averageMonthlyIncome:100000,averageMonthlyExpenses:30000,maxIncome:100000,incomeTransactions:1})
  }};
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('analytics-ui.js','utf8'),ctx,{filename:'analytics-ui.js'});
  vm.runInContext(fs.readFileSync('analytics-expense-ui.js','utf8'),ctx,{filename:'analytics-expense-ui.js'});
  return {ctx,dom};
}

test('analytics augmentation renders expense composition and lifetime cards',()=>{
  const {ctx,dom}=boot();ctx.renderAnalytics();
  assert.ok(dom.window.document.querySelector('[data-analytics-expense-composition]'));
  assert.ok(dom.window.document.querySelector('[data-analytics-lifetime]'));
  assert.match(dom.window.document.getElementById('page').textContent,/На что ушли деньги/);
  assert.match(dom.window.document.getElementById('page').textContent,/Средний финансовый месяц/);
  assert.match(dom.window.document.getElementById('page').textContent,/Жизнь/);
});
