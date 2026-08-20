const test=require('node:test');
const assert=require('node:assert/strict');

const core=require('../financial-core.js');
globalThis.ARISE_FINANCE_CORE=core;
require('../goal-lifecycle-core.js');

function profile(overrides={}){
  return {
    settings:{currency:'RUB',reserve:{enabled:false,percent:0,limit:null}},
    categories:[],goals:[],transactions:[],...overrides
  };
}

test('goal withdrawal returned to unallocated participates in later expenses in ledger order',()=>{
  const p=profile({
    goals:[{id:'g1',name:'Отпуск',target:1000,current:0,ledgerStart:0,status:'active'}],
    transactions:[
      {id:'i1',type:'income',date:'2026-08-01',month:'2026-08',amount:100,currency:'RUB',allocations:[],goalAllocations:[{goalId:'g1',amount:60}],reserve:0,remainder:40},
      {id:'w1',type:'goal_withdrawal',date:'2026-08-10',month:'2026-08',goalId:'g1',amount:60,destinationAccount:'free',currency:'RUB'},
      {id:'e1',type:'expense',date:'2026-08-11',month:'2026-08',amount:70,currency:'RUB'}
    ]
  });
  const stats=core.monthStats(p,'2026-08');
  assert.equal(core.goalBalance(p,'g1'),0);
  assert.equal(stats.goalWithdrawn,60);
  assert.equal(stats.free,30);
  assert.equal(stats.uncontrolled,0);
});

test('goal withdrawal can move the exact balance into reserve without creating money',()=>{
  const p=profile({goals:[{id:'g1',name:'Подушка',target:100,current:50,ledgerStart:50,status:'active'}]});
  const tx=core.createGoalWithdrawal(p,{id:'w1',goalId:'g1',amount:50,destinationAccount:'reserve',date:'2026-08-20',currency:'RUB'});
  p.transactions.push(tx);
  assert.equal(core.goalBalance(p,'g1'),0);
  assert.equal(core.reserveBalance(p),50);
  assert.equal(core.availableFree(p,'2026-08-20'),0);
});

test('goal to goal transfer is represented by a withdrawal and contribution pair',()=>{
  const p=profile({goals:[
    {id:'from',name:'Старая цель',target:100,current:80,ledgerStart:80,status:'active'},
    {id:'to',name:'Новая цель',target:200,current:0,ledgerStart:0,status:'active'}
  ]});
  const pair=core.createGoalTransfer(p,{goalId:'from',targetGoalId:'to',amount:80,date:'2026-08-20',currency:'RUB',withdrawalId:'w1',contributionId:'c1'});
  p.transactions.push(pair.withdrawal,pair.contribution);
  assert.equal(pair.withdrawal.destinationAccount,'goal');
  assert.equal(pair.contribution.sourceAccount,'goal');
  assert.equal(core.goalBalance(p,'from'),0);
  assert.equal(core.goalBalance(p,'to'),80);
  assert.equal(core.availableFree(p,'2026-08-20'),0);
  assert.equal(core.reserveBalance(p),0);
});

test('goal lifecycle rejects withdrawals above balance and transfers that cannot fit target',()=>{
  const p=profile({goals:[
    {id:'from',name:'A',target:100,current:80,ledgerStart:80,status:'active'},
    {id:'to',name:'B',target:50,current:0,ledgerStart:0,status:'active'}
  ]});
  assert.throws(()=>core.createGoalWithdrawal(p,{id:'w',goalId:'from',amount:81,destinationAccount:'free',date:'2026-08-20'}),/больше её текущего баланса/);
  assert.throws(()=>core.createGoalTransfer(p,{goalId:'from',targetGoalId:'to',amount:80,date:'2026-08-20',withdrawalId:'w',contributionId:'c'}),/недостаточно места/);
});

test('closed goal with auto allocation disabled never receives a future income allocation',()=>{
  const p=profile({goals:[{id:'g1',name:'Закрытая',target:100000,current:0,ledgerStart:0,status:'closed',autoAllocate:false,priority:5,monthlyContribution:50000}]});
  const plan=core.planIncome(p,100000,'2026-09-01');
  assert.equal(plan.goalAllocations.some(item=>item.goalId==='g1'),false);
  assert.equal(plan.remainder,100000);
});
