const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function boot(){
  const dom=new JSDOM('<!doctype html><div id="modal"><div id="sheet"></div></div><div id="page"></div>');
  const profile={
    settings:{currency:'RUB'},
    goals:[
      {id:'g1',name:'Отпуск',target:100000,current:10000,ledgerStart:10000,status:'active'},
      {id:'g2',name:'Техника',target:200000,current:0,ledgerStart:0,status:'active'}
    ],
    transactions:[]
  };
  const core={
    goalBalance:(p,g)=>{const goal=typeof g==='object'?g:p.goals.find(x=>x.id===g);const delta=p.transactions.reduce((s,tx)=>s+(tx.type==='goal_contribution'&&tx.goalId===goal.id?tx.amount:0)-(tx.type==='goal_withdrawal'&&tx.goalId===goal.id?tx.amount:0),0);return Math.max(0,goal.ledgerStart+delta);},
    goalRemaining:(p,g)=>Math.max(0,g.target-core.goalBalance(p,g)),
    createGoalWithdrawal:(p,data)=>({id:data.id,type:'goal_withdrawal',goalId:data.goalId,goalName:'Отпуск',amount:data.amount,destinationAccount:data.destinationAccount,date:data.date,currency:data.currency}),
    createGoalTransfer:()=>{throw new Error('not used');}
  };
  let saved=0,rendered=0;
  const ctx={console,document:dom.window.document,window:null,globalThis:null,ARISE_FINANCE_CORE:core,
    activeProfile:()=>profile,today:()=> '2026-08-20',uid:(()=>{let i=0;return()=>`id-${++i}`;})(),money:v=>`${v} ₽`,formatDate:v=>v,escapeHTML:v=>String(v??''),
    saveState:()=>{saved++;},render:()=>{rendered++;},toast:()=>{},closeModal:()=>dom.window.document.getElementById('modal').classList.remove('open'),
    openModal:html=>{dom.window.document.getElementById('sheet').innerHTML=html;dom.window.document.getElementById('modal').classList.add('open');},
    showGoalModal:id=>{dom.window.document.getElementById('sheet').innerHTML='<div class="field"><label>Уже накоплено</label><input id="goalCurrent" value="99999"></div><div class="actions"><button id="saveGoal">Сохранить</button></div>';},
    renderGoals:()=>{dom.window.document.getElementById('page').innerHTML='<div class="v3-page-head"><h1></h1><p></p></div><section class="v3-goal-list"><article data-goal-id="g1"></article><article data-goal-id="g2"></article></section>';},
    historyTransaction:()=>''
  };
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('goal-lifecycle-ui.js','utf8'),ctx,{filename:'goal-lifecycle-ui.js'});
  return {ctx,dom,profile,counts:()=>({saved,rendered})};
}

test('ledger-backed goal editor disables manual current balance and exposes close action',()=>{
  const {ctx,dom}=boot();
  ctx.showGoalModal('g1');
  const input=dom.window.document.getElementById('goalCurrent');
  assert.equal(input.value,'10000');
  assert.equal(input.disabled,true);
  assert.match(input.closest('.field').textContent,/Накоплено по операциям/);
  assert.ok(dom.window.document.querySelector('[data-close-funded-goal]'));
});

test('closing funded goal requires an explicit destination and preserves goal history record',()=>{
  const {ctx,dom,profile,counts}=boot();
  ctx.ARISE_GOAL_LIFECYCLE.showGoalCloseModal('g1');
  const select=dom.window.document.getElementById('goalCloseDestination');
  assert.ok(select);
  assert.deepEqual([...select.options].map(o=>o.value),['free','reserve','goal:g2']);
  select.value='free';
  dom.window.document.getElementById('confirmGoalClose').click();
  assert.equal(profile.goals.length,2,'goal must remain in profile history');
  assert.equal(profile.goals[0].status,'closed');
  assert.equal(profile.goals[0].closureDestination,'free');
  assert.equal(profile.transactions.length,1);
  assert.equal(profile.transactions[0].type,'goal_withdrawal');
  assert.equal(profile.transactions[0].amount,10000);
  assert.deepEqual(counts(),{saved:1,rendered:1});
});
