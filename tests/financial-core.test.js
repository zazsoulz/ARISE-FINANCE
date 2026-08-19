const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../financial-core.js');

const cat=(id,type,opts={})=>({
  id,name:opts.name||id,type,enabled:opts.enabled!==false,
  priority:opts.priority??3,percent:opts.percent??0,
  fixedAmount:opts.fixedAmount??0,limit:opts.limit??null
});
const goal=(id,opts={})=>({
  id,name:opts.name||id,target:opts.target??1000,current:opts.current??0,
  ledgerStart:opts.ledgerStart,priority:opts.priority??3,
  deadline:opts.deadline||'',monthlyContribution:opts.monthlyContribution??0,
  status:opts.status||'active',autoAllocate:opts.autoAllocate
});
const profile=(categories=[],reserve={enabled:false,percent:0,limit:null},transactions=[],goals=[])=>({
  categories,settings:{reserve},transactions,goals
});
const sumPlan=p=>p.allocations.reduce((s,a)=>s+a.amount,0)+
  (p.goalAllocations||[]).reduce((s,a)=>s+a.amount,0)+p.reserve+p.remainder;

test('fixed + percentage + remainder conserves exact units',()=>{
  const p=core.planIncome(profile([cat('fixed','fixed',{fixedAmount:200}),cat('pct','percentage',{percent:33})]),1000,'2026-08-19');
  assert.equal(p.valid,true);
  assert.equal(sumPlan(p),1000);
  assert.equal(p.allocations.find(a=>a.categoryId==='fixed').amount,200);
});

test('rounding never loses a unit',()=>{
  const p=core.planIncome(profile([cat('a','percentage',{percent:33}),cat('b','percentage',{percent:33}),cat('c','percentage',{percent:33})]),101,'2026-08-19');
  assert.equal(sumPlan(p),101);
  assert.ok(Number.isInteger(p.remainder));
});

test('fixed commitments exceeding income are invalid',()=>{
  const p=core.planIncome(profile([cat('a','fixed',{fixedAmount:80}),cat('b','fixed',{fixedAmount:30})]),100,'2026-08-19');
  assert.equal(p.valid,false);
  assert.match(p.error,/превышают/i);
});

test('positive unallocated remainder is valid',()=>{
  const p=core.planIncome(profile([cat('a','percentage',{percent:20})]),1000,'2026-08-19');
  assert.equal(p.valid,true);
  assert.ok(p.remainder>0);
  assert.equal(sumPlan(p),1000);
});

test('manual over-allocation is invalid',()=>{
  const v=core.validatePlan({total:100,allocations:[{amount:80},{amount:30}],reserve:0});
  assert.equal(v.valid,false);
  assert.equal(v.difference,-10);
});

test('goal allocations participate in validation',()=>{
  const v=core.validatePlan({total:100,allocations:[{amount:50}],goalAllocations:[{amount:30}],reserve:10});
  assert.equal(v.valid,true);
  assert.equal(v.remainder,10);
  assert.equal(v.distributed,90);
});

test('category named Свободные деньги is ordinary',()=>{
  const p=core.planIncome(profile([cat('freecat','percentage',{name:'Свободные деньги',percent:25})]),1000,'2026-08-19');
  assert.equal(p.allocations[0].categoryId,'freecat');
  assert.equal(p.allocations[0].amount,250);
  assert.equal(p.remainder,750);
});

test('legacy income derives remainder safely',()=>{
  assert.equal(core.historicalRemainder({type:'income',amount:1000,allocations:[{amount:600}],reserve:100}),300);
});

test('legacy remainder also subtracts goal allocations',()=>{
  assert.equal(core.historicalRemainder({type:'income',amount:1000,allocations:[{amount:500}],goalAllocations:[{amount:200}],reserve:100}),200);
});

test('uncategorized expense consumes free then creates uncontrolled excess',()=>{
  const pr=profile([],{},[{type:'income',date:'2026-08-01',amount:100,remainder:20,allocations:[],reserve:0},{type:'expense',date:'2026-08-02',amount:30}]);
  const s=core.monthStats(pr,'2026-08');
  assert.equal(s.free,0);
  assert.equal(s.freeSpent,20);
  assert.equal(s.uncontrolled,10);
});

test('explicit category expense reduces category not free',()=>{
  const pr=profile([],{},[{type:'income',date:'2026-08-01',amount:100,allocations:[{categoryId:'c',amount:50}],reserve:0,remainder:50},{type:'expense',date:'2026-08-02',amount:20,categoryId:'c'}]);
  const s=core.monthStats(pr,'2026-08');
  assert.equal(s.categoryBalances.c,30);
  assert.equal(s.free,50);
  assert.equal(s.uncontrolled,0);
});

test('monthly category limit is cumulative across incomes',()=>{
  const c=cat('c','percentage',{percent:100,limit:100});
  const pr=profile([c],{},[{type:'income',date:'2026-08-01',amount:70,allocations:[{categoryId:'c',amount:70}],reserve:0,remainder:0}]);
  const p=core.planIncome(pr,70,'2026-08-10');
  assert.equal(p.allocations.find(a=>a.categoryId==='c').amount,30);
  assert.equal(p.remainder,40);
});

test('monthly reserve limit is cumulative',()=>{
  const pr=profile([],{enabled:true,percent:100,limit:100},[{type:'income',date:'2026-08-01',amount:60,allocations:[],reserve:60,remainder:0}]);
  const p=core.planIncome(pr,80,'2026-08-11');
  assert.equal(p.reserve,40);
  assert.equal(p.remainder,40);
});

test('priority materially affects constrained percentage allocation',()=>{
  const pr=profile([cat('low','percentage',{percent:80,priority:1}),cat('high','percentage',{percent:80,priority:5})]);
  const p=core.planIncome(pr,100,'2026-08-19');
  const high=p.allocations.find(a=>a.categoryId==='high')?.amount||0;
  const low=p.allocations.find(a=>a.categoryId==='low')?.amount||0;
  assert.ok(high>=low);
  assert.equal(sumPlan(p),100);
});

test('disabled rules receive no allocation',()=>{
  const p=core.planIncome(profile([cat('off','percentage',{percent:100,enabled:false})]),100,'2026-08-19');
  assert.equal(p.allocations.length,0);
  assert.equal(p.remainder,100);
});

test('multiple incomes aggregate consistently',()=>{
  const pr=profile([],{},[{type:'income',date:'2026-08-01',amount:100,allocations:[],reserve:10,remainder:90},{type:'income',date:'2026-08-02',amount:50,allocations:[],reserve:5,remainder:45},{type:'expense',date:'2026-08-03',amount:20}]);
  const s=core.monthStats(pr,'2026-08');
  assert.equal(s.income,150);
  assert.equal(s.reserve,15);
  assert.equal(s.free,115);
  assert.equal(s.operationCount,3);
});

test('income plan allocates to a configured goal and conserves money',()=>{
  const g=goal('trip',{target:1000,monthlyContribution:300,priority:4});
  const p=core.planIncome(profile([],{},[],[g]),500,'2026-08-19');
  assert.equal(p.goalAllocations.length,1);
  assert.equal(p.goalAllocations[0].amount,300);
  assert.equal(p.remainder,200);
  assert.equal(sumPlan(p),500);
});

test('goal allocation never exceeds remaining target',()=>{
  const g=goal('trip',{target:1000,current:950,monthlyContribution:300});
  const p=core.planIncome(profile([],{},[],[g]),500,'2026-08-19');
  assert.equal(p.goalAllocations[0].amount,50);
  assert.equal(p.remainder,450);
});

test('higher-priority goal receives constrained money first',()=>{
  const low=goal('low',{target:1000,monthlyContribution:100,priority:1});
  const high=goal('high',{target:1000,monthlyContribution:100,priority:5});
  const p=core.planIncome(profile([],{},[],[low,high]),120,'2026-08-19');
  assert.equal(p.goalAllocations[0].goalId,'high');
  assert.equal(p.goalAllocations[0].amount,100);
  assert.equal(p.goalAllocations[1].goalId,'low');
  assert.equal(p.goalAllocations[1].amount,20);
});

test('deadline can create a monthly need when monthly contribution is zero',()=>{
  const g=goal('urgent',{target:1200,current:0,monthlyContribution:0,deadline:'2026-10-31'});
  assert.equal(core.goalMonthlyNeed(profile([],{},[],[g]),g,'2026-08-19'),400);
});

test('same-month prior goal funding reduces the next income goal allocation',()=>{
  const g=goal('trip',{target:1000,ledgerStart:0,current:0,monthlyContribution:300});
  const tx={type:'income',date:'2026-08-05',amount:200,allocations:[],goalAllocations:[{goalId:'trip',amount:200}],reserve:0,remainder:0};
  const pr=profile([],{},[tx],[g]);
  const p=core.planIncome(pr,500,'2026-08-19');
  assert.equal(p.goalAllocations[0].amount,100);
  assert.equal(p.remainder,400);
});

test('completed goals receive no automatic allocation',()=>{
  const done=goal('done',{target:100,current:100,status:'completed',monthlyContribution:100,priority:5});
  const next=goal('next',{target:1000,monthlyContribution:100,priority:1});
  const p=core.planIncome(profile([],{},[],[done,next]),100,'2026-08-19');
  assert.equal(p.goalAllocations.length,1);
  assert.equal(p.goalAllocations[0].goalId,'next');
});

test('autoAllocate false keeps a goal out of automatic income plans',()=>{
  const g=goal('manual',{target:1000,monthlyContribution:500,autoAllocate:false});
  const p=core.planIncome(profile([],{},[],[g]),500,'2026-08-19');
  assert.equal(p.goalAllocations.length,0);
  assert.equal(p.remainder,500);
});

test('goal contribution is a real transfer from free money',()=>{
  const g=goal('trip',{target:1000,current:100,ledgerStart:100});
  const pr=profile([],{},[{type:'income',date:'2026-08-01',amount:500,allocations:[],reserve:0,remainder:500}],[g]);
  const tx=core.createGoalContribution(pr,{id:'gc1',goalId:'trip',amount:200,date:'2026-08-19',currency:'RUB'});
  pr.transactions.push(tx);
  assert.equal(core.goalBalance(pr,g),300);
  const s=core.monthStats(pr,'2026-08');
  assert.equal(s.free,300);
  assert.equal(s.goalFundedFromFree,200);
});

test('goal contribution cannot create money from thin air',()=>{
  const g=goal('trip',{target:1000,current:0,ledgerStart:0});
  const pr=profile([],{},[{type:'income',date:'2026-08-01',amount:100,allocations:[],reserve:0,remainder:100}],[g]);
  assert.throws(()=>core.createGoalContribution(pr,{id:'gc1',goalId:'trip',amount:101,date:'2026-08-19'}),/Недостаточно свободных денег/);
});

test('goal contribution caps at remaining target',()=>{
  const g=goal('trip',{target:1000,current:950,ledgerStart:950});
  const pr=profile([],{},[{type:'income',date:'2026-08-01',amount:500,allocations:[],reserve:0,remainder:500}],[g]);
  const tx=core.createGoalContribution(pr,{id:'gc1',goalId:'trip',amount:200,date:'2026-08-19'});
  assert.equal(tx.amount,50);
});

test('reserve balance is ledger based and supports withdrawal',()=>{
  const pr=profile([],{},[
    {type:'income',date:'2026-08-01',amount:500,allocations:[],reserve:100,remainder:400},
    {type:'income',date:'2026-08-02',amount:500,allocations:[],reserve:50,remainder:450}
  ]);
  assert.equal(core.reserveBalance(pr),150);
  const tx=core.createReserveWithdrawal(pr,{id:'rw1',amount:60,date:'2026-08-19',currency:'RUB'});
  pr.transactions.push(tx);
  assert.equal(core.reserveBalance(pr),90);
});

test('reserve cannot be withdrawn below zero',()=>{
  const pr=profile([],{},[{type:'income',date:'2026-08-01',amount:100,allocations:[],reserve:20,remainder:80}]);
  assert.throws(()=>core.createReserveWithdrawal(pr,{amount:21,date:'2026-08-19'}),/Недостаточно денег в резерве/);
});

test('simulateIncome does not mutate the profile',()=>{
  const g=goal('trip',{target:1000,monthlyContribution:100});
  const pr=profile([cat('life','percentage',{percent:20})],{enabled:true,percent:10,limit:null},[],[g]);
  const before=JSON.stringify(pr);
  const p=core.simulateIncome(pr,1000,'2026-08-19');
  assert.equal(sumPlan(p),1000);
  assert.equal(JSON.stringify(pr),before);
});

test('income transaction persists categories reserve goals and exact remainder',()=>{
  const tx=core.createIncomeTransaction({
    id:'i1',total:1000,date:'2026-08-19',currency:'RUB',
    allocations:[{categoryId:'life',amount:400}],reserve:100,
    goalAllocations:[{goalId:'trip',amount:200}]
  });
  assert.equal(tx.amount,1000);
  assert.equal(tx.goalAllocations[0].amount,200);
  assert.equal(tx.remainder,300);
  assert.equal(core.historicalRemainder(tx),300);
});
