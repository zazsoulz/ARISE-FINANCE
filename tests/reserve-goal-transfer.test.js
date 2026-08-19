const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../financial-core.js');

function profile(){
  return {
    categories:[],
    settings:{reserve:{enabled:true,percent:0,limit:null}},
    goals:[{
      id:'trip',name:'Отпуск',target:1000,current:0,ledgerStart:0,
      priority:3,deadline:'',monthlyContribution:0,status:'active'
    }],
    transactions:[{
      id:'income-1',type:'income',date:'2026-08-01',month:'2026-08',
      amount:500,currency:'RUB',allocations:[],goalAllocations:[],reserve:300,remainder:200
    }]
  };
}

test('reserve-funded goal contribution transfers money instead of duplicating it',()=>{
  const pr=profile();
  const beforeReserve=core.reserveBalance(pr);
  const beforeGoal=core.goalBalance(pr,'trip');

  const tx=core.createGoalContribution(pr,{
    id:'goal-from-reserve',goalId:'trip',amount:120,sourceAccount:'reserve',
    date:'2026-08-19',currency:'RUB'
  });
  pr.transactions.push(tx);

  assert.equal(beforeReserve,300);
  assert.equal(beforeGoal,0);
  assert.equal(core.reserveBalance(pr),180);
  assert.equal(core.goalBalance(pr,'trip'),120);
  assert.equal(core.reserveBalance(pr)+core.goalBalance(pr,'trip'),300);

  const stats=core.monthStats(pr,'2026-08');
  assert.equal(stats.reserveWithdrawn,120);
  assert.equal(stats.free,200);
  assert.equal(stats.uncontrolled,0);
});

test('reserve money already transferred to a goal cannot be spent twice',()=>{
  const pr=profile();
  const first=core.createGoalContribution(pr,{
    id:'first',goalId:'trip',amount:250,sourceAccount:'reserve',
    date:'2026-08-19',currency:'RUB'
  });
  pr.transactions.push(first);

  assert.equal(core.reserveBalance(pr),50);
  assert.throws(()=>core.createGoalContribution(pr,{
    id:'second',goalId:'trip',amount:51,sourceAccount:'reserve',
    date:'2026-08-20',currency:'RUB'
  }),/Недостаточно денег в резерве/);
  assert.throws(()=>core.createReserveWithdrawal(pr,{
    id:'withdraw',amount:51,date:'2026-08-20',currency:'RUB'
  }),/Недостаточно денег в резерве/);
});
