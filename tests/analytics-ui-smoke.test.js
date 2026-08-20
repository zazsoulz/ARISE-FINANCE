const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function boot(){
  const dom=new JSDOM('<!doctype html><div id="page"></div>');
  const profile={settings:{currency:'RUB',reserve:{target:100000}},transactions:[],goals:[]};
  const ctx={
    console,document:dom.window.document,window:null,globalThis:null,activeMonth:'2026-08',activePage:'analytics',activeProfile:()=>profile,renderNav:()=>'<nav class="nav"></nav>',
    money:value=>`${Math.round(Number(value)||0)} ₽`,formatMonth:key=>key,formatDate:value=>value,escapeHTML:value=>String(value??''),
    ARISE_FINANCE_CORE:{reserveBalance:()=>30000},
    ARISE_ANALYTICS:{
      months:()=>['2026-07','2026-08'],
      monthly:(_p,key)=>key==='2026-08'?{income:150000,expenses:50000,freeEnd:80000,uncontrolled:10000,incomeCount:2}:{income:100000,expenses:40000,freeEnd:50000,uncontrolled:0,incomeCount:1},
      compare:()=>({income:{difference:50000,percent:50},expenses:{difference:10000,percent:25},free:{difference:30000,percent:60},uncontrolled:{difference:10000,percent:null}}),
      series:()=>[{month:'2026-07',income:100000,expenses:40000},{month:'2026-08',income:150000,expenses:50000}],
      incomeSources:(_p,{month})=>month==='2026-08'?[{name:'Работа',value:120000,share:.8},{name:'Фриланс',value:30000,share:.2}]:[{name:'Работа',value:100000,share:1}],goals:()=>[]
    }
  };
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('analytics-ui.js','utf8'),ctx,{filename:'analytics-ui.js'});return {ctx,dom};
}

test('analytics screen renders canonical visual blocks in browser runtime',()=>{
  const {ctx,dom}=boot();ctx.renderAnalytics();
  assert.ok(dom.window.document.querySelector('.arise-analytics'));
  assert.ok(dom.window.document.querySelector('.analytics-pulse'));
  assert.ok(dom.window.document.querySelector('.analytics-source-row'));
  assert.ok(dom.window.document.querySelector('.analytics-reserve-orbit'));
  assert.match(dom.window.document.getElementById('page').textContent,/Расходы вне плана/);
});

test('analytics month selector is local and does not mutate global app month',()=>{
  const {ctx,dom}=boot();ctx.renderAnalytics();const select=dom.window.document.getElementById('analyticsMonth');select.value='2026-07';select.onchange();
  assert.equal(ctx.activeMonth,'2026-08');assert.equal(ctx.ARISE_ANALYTICS_UI.getSelectedMonth(),'2026-07');assert.match(dom.window.document.querySelector('.analytics-head').textContent,/2026-07/);
});

test('financial pulse uses a shared vertical scale instead of normalizing each series separately',()=>{
  const {ctx}=boot();
  assert.equal(ctx.ARISE_ANALYTICS_UI.path([100],720,200,20,1000),'M360.0 164.0');
  assert.notEqual(ctx.ARISE_ANALYTICS_UI.path([100],720,200,20,1000),ctx.ARISE_ANALYTICS_UI.path([100],720,200,20,100));
});
