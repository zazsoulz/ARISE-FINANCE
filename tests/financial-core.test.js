const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../financial-core.js');

const cat=(id,type,opts={})=>({id,name:opts.name||id,type,enabled:opts.enabled!==false,priority:opts.priority??3,percent:opts.percent??0,fixedAmount:opts.fixedAmount??0,limit:opts.limit??null});
const goal=(id,opts={})=>({id,name:opts.name||id,target:opts.target??1000,current:opts.current??0,ledgerStart:opts.ledgerStart,priority:opts.priority??3,deadline:opts.deadline||'',monthlyContribution:opts.monthlyContribution??0,status:opts.status||'active',autoAllocate:opts.autoAllocate});
const profile=(categories=[],reserve={enabled:false,percent:0,limit:null},transactions=[],goals=[])=>({categories,settings:{reserve},transactions,goals});
const sumPlan=p=>p.allocations.reduce((s,a)=>s+a.amount,0)+(p.goalAllocations||[]).reduce((s,a)=>s+a.amount,0)+p.reserve+p.remainder;

test('plan always conserves exact money',()=>{
  const p=core.planIncome(profile([cat('fixed','fixed',{fixedAmount:200}),cat('pct','percentage',{percent:33})]),1000,'2026-08-19');
  assert.equal(p.valid,true); assert.equal(sumPlan(p),1000);
});

test('fixed rule is monthly and only tops up remaining monthly amount',()=>{
  const fixed=cat('rent','fixed',{fixedAmount:30000,priority:5});
  const pr=profile([fixed],{},[{type:'income',date:'2026-08-01',amount:50000,allocations:[{categoryId:'rent',amount:20000}],reserve:0,remainder:30000}]);
  const p=core.planIncome(pr,100000,'2026-08-15');
  assert.equal(p.allocations.find(a=>a.categoryId==='rent').amount,10000);
  assert.equal(p.remainder,90000);
});

test('fixed rule resets in a new month',()=>{
  const fixed=cat('rent','fixed',{fixedAmount:30000,priority:5});
  const pr=profile([fixed],{},[{type:'income',date:'2026-08-01',amount:50000,allocations:[{categoryId:'rent',amount:30000}],reserve:0,remainder:20000}]);
  const p=core.planIncome(pr,100000,'2026-09-01');
  assert.equal(p.allocations.find(a=>a.categoryId==='rent').amount,30000);
});

test('percentage applies to every income amount when no monthly limit exists',()=>{
  const c=cat('art','percentage',{percent:10});
  const pr=profile([c],{},[{type:'income',date:'2026-08-01',amount:100000,allocations:[{categoryId:'art',amount:10000}],reserve:0,remainder:90000}]);
  const p=core.planIncome(pr,50000,'2026-08-15');
  assert.equal(p.allocations.find(a=>a.categoryId==='art').amount,5000);
});

test('monthly percentage limit remains cumulative across incomes',()=>{
  const c=cat('art','percentage',{percent:50,limit:12000});
  const pr=profile([c],{},[{type:'income',date:'2026-08-01',amount:20000,allocations:[{categoryId:'art',amount:10000}],reserve:0,remainder:10000}]);
  const p=core.planIncome(pr,10000,'2026-08-15');
  assert.equal(p.allocations.find(a=>a.categoryId==='art').amount,2000);
});

test('unallocated money carries into the next month',()=>{
  const pr=profile([],{},[{type:'income',date:'2026-08-20',amount:50000,allocations:[],reserve:0,remainder:37000},{type:'expense',date:'2026-08-25',amount:7000}]);
  assert.equal(core.monthStats(pr,'2026-08').free,30000);
  assert.equal(core.monthStats(pr,'2026-09').free,30000);
  assert.equal(core.availableFree(pr,'2026-09-10'),30000);
});

test('category overspend automatically uses unallocated balance before uncontrolled money',()=>{
  const pr=profile([],{},[
    {type:'income',date:'2026-08-01',amount:30000,allocations:[{categoryId:'life',amount:8000}],reserve:0,remainder:22000},
    {type:'expense',date:'2026-08-02',amount:12000,categoryId:'life'}
  ]);
  const s=core.monthStats(pr,'2026-08');
  assert.equal(s.categorySpent.life,8000);
  assert.equal(s.freeSpent,4000);
  assert.equal(s.free,18000);
  assert.equal(s.uncontrolled,0);
});

test('category overspend reports only truly unexplained excess as uncontrolled',()=>{
  const pr=profile([],{},[
    {type:'income',date:'2026-08-01',amount:10000,allocations:[{categoryId:'life',amount:8000}],reserve:0,remainder:2000},
    {type:'expense',date:'2026-08-02',amount:12000,categoryId:'life'}
  ]);
  const s=core.monthStats(pr,'2026-08');
  assert.equal(s.categorySpent.life,8000);
  assert.equal(s.freeSpent,2000);
  assert.equal(s.uncontrolled,2000);
});

test('higher priority wins across category reserve and goal when money is constrained',()=>{
  const c=cat('life','percentage',{percent:100,priority:1});
  const g=goal('trip',{target:1000,monthlyContribution:100,priority:5});
  const pr=profile([c],{enabled:true,percent:100,limit:null,priority:3},[],[g]);
  const p=core.planIncome(pr,100,'2026-08-19');
  assert.equal(p.goalAllocations[0].goalId,'trip');
  assert.equal(p.goalAllocations[0].amount,100);
  assert.equal(p.reserve,0);
  assert.equal(p.allocations.length,0);
});

test('reserve can outrank category using the same priority system',()=>{
  const c=cat('life','percentage',{percent:100,priority:1});
  const pr=profile([c],{enabled:true,percent:50,limit:null,priority:5});
  const p=core.planIncome(pr,100,'2026-08-19');
  assert.equal(p.reserve,50);
  assert.equal(p.allocations.find(a=>a.categoryId==='life').amount,50);
});

test('goal deadline status is advisory and exposes required monthly amount',()=>{
  const g=goal('trip',{target:120000,current:0,monthlyContribution:10000,deadline:'2026-11-30'});
  const pr=profile([],{},[],[g]);
  const status=core.goalDeadlineStatus(pr,g,'2026-08-19');
  assert.equal(status.requiredMonthly,30000);
  assert.equal(status.plannedMonthly,10000);
  assert.equal(status.shortfall,20000);
  assert.equal(status.onTrack,false);
});

test('manual over-allocation is invalid',()=>{
  const v=core.validatePlan({total:100,allocations:[{amount:80},{amount:30}],reserve:0});
  assert.equal(v.valid,false); assert.equal(v.difference,-10);
});

test('category named Свободные деньги is an ordinary category',()=>{
  const p=core.planIncome(profile([cat('freecat','percentage',{name:'Свободные деньги',percent:25})]),1000,'2026-08-19');
  assert.equal(p.allocations[0].categoryId,'freecat'); assert.equal(p.allocations[0].amount,250); assert.equal(p.remainder,750);
});

test('legacy remainder subtracts categories goals and reserve',()=>{
  assert.equal(core.historicalRemainder({type:'income',amount:1000,allocations:[{amount:500}],goalAllocations:[{amount:200}],reserve:100}),200);
});

test('monthly reserve limit is cumulative',()=>{
  const pr=profile([],{enabled:true,percent:100,limit:100,priority:3},[{type:'income',date:'2026-08-01',amount:60,allocations:[],reserve:60,remainder:0}]);
  const p=core.planIncome(pr,80,'2026-08-11');
  assert.equal(p.reserve,40); assert.equal(p.remainder,40);
});

test('disabled rules receive no allocation',()=>{
  const p=core.planIncome(profile([cat('off','percentage',{percent:100,enabled:false})]),100,'2026-08-19');
  assert.equal(p.allocations.length,0); assert.equal(p.remainder,100);
});

test('goal allocation never exceeds remaining target',()=>{
  const g=goal('trip',{target:1000,current:950,monthlyContribution:300});
  const p=core.planIncome(profile([],{},[],[g]),500,'2026-08-19');
  assert.equal(p.goalAllocations[0].amount,50); assert.equal(p.remainder,450);
});

test('completed and manual-only goals receive no automatic proposal',()=>{
  const done=goal('done',{target:100,current:100,status:'completed',monthlyContribution:100,priority:5});
  const manual=goal('manual',{target:1000,monthlyContribution:500,autoAllocate:false});
  const p=core.planIncome(profile([],{},[],[done,manual]),500,'2026-08-19');
  assert.equal(p.goalAllocations.length,0); assert.equal(p.remainder,500);
});

test('goal contribution is a real transfer from carried unallocated money',()=>{
  const g=goal('trip',{target:1000,current:100,ledgerStart:100});
  const pr=profile([],{},[{type:'income',date:'2026-07-01',amount:500,allocations:[],reserve:0,remainder:500}],[g]);
  const tx=core.createGoalContribution(pr,{id:'gc1',goalId:'trip',amount:200,date:'2026-08-19',currency:'RUB'});
  pr.transactions.push(tx);
  assert.equal(core.goalBalance(pr,g),300);
  assert.equal(core.monthStats(pr,'2026-08').free,300);
});

test('reserve balance is ledger based and cannot go below zero',()=>{
  const pr=profile([],{},[{type:'income',date:'2026-08-01',amount:500,allocations:[],reserve:100,remainder:400}]);
  assert.equal(core.reserveBalance(pr),100);
  assert.throws(()=>core.createReserveWithdrawal(pr,{amount:101,date:'2026-08-19'}),/Недостаточно денег/);
});

test('simulateIncome never mutates profile',()=>{
  const pr=profile([cat('life','percentage',{percent:20})],{enabled:true,percent:10,limit:null,priority:3},[],[goal('trip',{monthlyContribution:100})]);
  const before=JSON.stringify(pr); const p=core.simulateIncome(pr,1000,'2026-08-19');
  assert.equal(sumPlan(p),1000); assert.equal(JSON.stringify(pr),before);
});

test('income transaction persists exact remainder',()=>{
  const tx=core.createIncomeTransaction({id:'i1',total:1000,date:'2026-08-19',currency:'RUB',allocations:[{categoryId:'life',amount:400}],reserve:100,goalAllocations:[{goalId:'trip',amount:200}]});
  assert.equal(tx.remainder,300); assert.equal(core.historicalRemainder(tx),300);
});
