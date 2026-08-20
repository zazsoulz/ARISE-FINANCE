const test=require('node:test');
const assert=require('node:assert/strict');
const analytics=require('../goal-completion-analytics.js');

function profile(){
  return {
    goals:[
      {id:'g1',name:'Отпуск',status:'completed',target:100000,createdAt:'2026-01-10',completedAt:'2026-04-20',ledgerStart:10000,initialForecastMonths:6,initialForecastDate:'2026-07-10'},
      {id:'g2',name:'Техника',status:'completed',target:60000,createdAt:'2026-02-01',completedAt:'2026-08-01',ledgerStart:0,initialForecastMonths:7,initialForecastDate:'2026-09-01'},
      {id:'g3',name:'Активная',status:'active',target:50000,createdAt:'2026-03-01',ledgerStart:0}
    ],
    transactions:[
      {id:'i1',type:'income',date:'2026-02-10',goalAllocations:[{goalId:'g1',amount:30000}]},
      {id:'i2',type:'income',date:'2026-03-10',goalAllocations:[{goalId:'g1',amount:30000}]},
      {id:'i3',type:'income',date:'2026-04-10',goalAllocations:[{goalId:'g1',amount:30000}]},
      {id:'c1',type:'goal_contribution',goalId:'g2',amount:30000,date:'2026-04-01',sourceAccount:'free'},
      {id:'c2',type:'goal_contribution',goalId:'g2',amount:30000,date:'2026-08-01',sourceAccount:'free'}
    ]
  };
}

test('completed-goal analytics summarize only completed lifecycle entities',()=>{
  const result=analytics.summary(profile());
  assert.equal(result.total,2);
  assert.equal(result.goals.length,2);
  assert.equal(result.goals[0].name,'Техника');
  assert.equal(result.goals[1].name,'Отпуск');
  assert.equal(result.goals.every(goal=>goal.completionMethod==='target_reached'),true);
});

test('completed-goal analytics compare actual duration with original forecast',()=>{
  const result=analytics.summary(profile());
  const vacation=result.goals.find(goal=>goal.id==='g1');
  assert.equal(vacation.actualMonths,4);
  assert.equal(vacation.initialForecastMonths,6);
  assert.equal(vacation.forecastDifference,-2);
  assert.equal(result.ahead,1);
  assert.equal(result.onForecast,1);
  assert.equal(result.behind,0);
});

test('completed-goal totals stay transaction-derived',()=>{
  const result=analytics.summary(profile());
  const vacation=result.goals.find(goal=>goal.id==='g1');
  assert.equal(vacation.contributed,100000);
  assert.equal(vacation.contributionCount,3);
  assert.equal(result.totalContributed,160000);
});

test('production loader wires completed-goal analytics before its UI layer',()=>{
  const fs=require('node:fs');
  const index=fs.readFileSync('index.html','utf8');
  const engine=index.indexOf('./goal-completion-analytics.js');
  const ui=index.indexOf('./goal-completion-analytics-ui.js');
  assert.ok(engine>=0);
  assert.ok(ui>engine);
});
