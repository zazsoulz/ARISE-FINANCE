const test=require('node:test');
const assert=require('node:assert/strict');
const history=require('../goal-history.js');

test('new goal snapshot preserves initial plan',()=>{
  const snap=history.initialSnapshot({target:120000,current:20000,monthlyContribution:20000,deadline:'2026-12-31',createdAt:'2026-08-01'});
  assert.equal(snap.initialTarget,120000);
  assert.equal(snap.initialBalance,20000);
  assert.equal(snap.initialForecastMonths,5);
  assert.equal(snap.initialForecastDate,'2027-01-01');
});

test('goal history is derived from income allocations and explicit goal operations',()=>{
  const goal={id:'g1',createdAt:'2026-01-10',completedAt:'2026-04-20',ledgerStart:10000,initialForecastMonths:6,initialForecastDate:'2026-07-10'};
  const profile={transactions:[
    {id:'i1',type:'income',date:'2026-02-01',source:'Работа',goalAllocations:[{goalId:'g1',amount:20000}]},
    {id:'c1',type:'goal_contribution',date:'2026-03-03',goalId:'g1',amount:30000,sourceAccount:'free'},
    {id:'w1',type:'goal_withdrawal',date:'2026-03-15',goalId:'g1',amount:5000},
    {id:'i2',type:'income',date:'2026-04-01',source:'Премия',goalAllocations:[{goalId:'g1',amount:45000}]}
  ]};
  const info=history.analyzeGoal(profile,goal);
  assert.equal(info.contributed,105000);
  assert.equal(info.withdrawn,5000);
  assert.equal(info.net,100000);
  assert.equal(info.contributionCount,3);
  assert.equal(info.contributionMonths,3);
  assert.equal(info.averageMonthly,31667);
  assert.equal(info.actualMonths,4);
  assert.equal(info.forecastDifference,-2);
  assert.equal(info.events.length,5);
});

test('old completed goal without snapshot reports forecast as unavailable',()=>{
  const info=history.analyzeGoal({transactions:[]},{id:'g',createdAt:'2026-01-01',completedAt:'2026-02-01',current:0});
  assert.equal(info.initialForecastMonths,null);
  assert.equal(info.forecastDifference,null);
});
