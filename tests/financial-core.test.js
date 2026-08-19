const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../financial-core.js');
const cat=(id,type,opts={})=>({id,name:opts.name||id,type,enabled:opts.enabled!==false,priority:opts.priority??3,percent:opts.percent??0,fixedAmount:opts.fixedAmount??0,limit:opts.limit??null});
const profile=(categories,reserve={enabled:false,percent:0,limit:null},transactions=[])=>({categories,settings:{reserve},transactions});
const sumPlan=p=>p.allocations.reduce((s,a)=>s+a.amount,0)+p.reserve+p.remainder;

test('fixed + percentage + remainder conserves exact units',()=>{
  const p=core.planIncome(profile([cat('fixed','fixed',{fixedAmount:200}),cat('pct','percentage',{percent:33})]),1000,'2026-08-19');
  assert.equal(p.valid,true); assert.equal(sumPlan(p),1000); assert.equal(p.allocations.find(a=>a.categoryId==='fixed').amount,200);
});

test('rounding never loses a unit',()=>{
  const p=core.planIncome(profile([cat('a','percentage',{percent:33}),cat('b','percentage',{percent:33}),cat('c','percentage',{percent:33})]),101,'2026-08-19');
  assert.equal(sumPlan(p),101); assert.ok(Number.isInteger(p.remainder));
});

test('fixed commitments exceeding income are invalid',()=>{
  const p=core.planIncome(profile([cat('a','fixed',{fixedAmount:80}),cat('b','fixed',{fixedAmount:30})]),100,'2026-08-19');
  assert.equal(p.valid,false); assert.match(p.error,/превышают/i);
});

test('positive unallocated remainder is valid',()=>{
  const p=core.planIncome(profile([cat('a','percentage',{percent:20})]),1000,'2026-08-19');
  assert.equal(p.valid,true); assert.ok(p.remainder>0); assert.equal(sumPlan(p),1000);
});

test('manual over-allocation is invalid',()=>{
  const v=core.validatePlan({total:100,allocations:[{amount:80},{amount:30}],reserve:0});
  assert.equal(v.valid,false); assert.equal(v.difference,-10);
});

test('category named Свободные деньги is ordinary',()=>{
  const p=core.planIncome(profile([cat('freecat','percentage',{name:'Свободные деньги',percent:25})]),1000,'2026-08-19');
  assert.equal(p.allocations[0].categoryId,'freecat'); assert.equal(p.allocations[0].amount,250); assert.equal(p.remainder,750);
});

test('legacy income derives remainder safely',()=>{
  assert.equal(core.historicalRemainder({type:'income',amount:1000,allocations:[{amount:600}],reserve:100}),300);
});

test('uncategorized expense consumes free then creates uncontrolled excess',()=>{
  const pr=profile([],{},[{type:'income',date:'2026-08-01',amount:100,remainder:20,allocations:[],reserve:0},{type:'expense',date:'2026-08-02',amount:30}]);
  const s=core.monthStats(pr,'2026-08'); assert.equal(s.free,0); assert.equal(s.freeSpent,20); assert.equal(s.uncontrolled,10);
});

test('explicit category expense reduces category not free',()=>{
  const pr=profile([],{},[{type:'income',date:'2026-08-01',amount:100,allocations:[{categoryId:'c',amount:50}],reserve:0,remainder:50},{type:'expense',date:'2026-08-02',amount:20,categoryId:'c'}]);
  const s=core.monthStats(pr,'2026-08'); assert.equal(s.categoryBalances.c,30); assert.equal(s.free,50); assert.equal(s.uncontrolled,0);
});

test('monthly category limit is cumulative across incomes',()=>{
  const c=cat('c','percentage',{percent:100,limit:100});
  const pr=profile([c],{},[{type:'income',date:'2026-08-01',amount:70,allocations:[{categoryId:'c',amount:70}],reserve:0,remainder:0}]);
  const p=core.planIncome(pr,70,'2026-08-10'); assert.equal(p.allocations.find(a=>a.categoryId==='c').amount,30); assert.equal(p.remainder,40);
});

test('monthly reserve limit is cumulative',()=>{
  const pr=profile([],{enabled:true,percent:100,limit:100},[{type:'income',date:'2026-08-01',amount:60,allocations:[],reserve:60,remainder:0}]);
  const p=core.planIncome(pr,80,'2026-08-11'); assert.equal(p.reserve,40); assert.equal(p.remainder,40);
});

test('priority materially affects constrained percentage allocation',()=>{
  const pr=profile([cat('low','percentage',{percent:80,priority:1}),cat('high','percentage',{percent:80,priority:5})]);
  const p=core.planIncome(pr,100,'2026-08-19');
  const high=p.allocations.find(a=>a.categoryId==='high')?.amount||0;
  const low=p.allocations.find(a=>a.categoryId==='low')?.amount||0;
  assert.ok(high>=low); assert.equal(sumPlan(p),100);
});

test('disabled rules receive no allocation',()=>{
  const p=core.planIncome(profile([cat('off','percentage',{percent:100,enabled:false})]),100,'2026-08-19'); assert.equal(p.allocations.length,0); assert.equal(p.remainder,100);
});

test('multiple incomes aggregate consistently',()=>{
  const pr=profile([],{},[{type:'income',date:'2026-08-01',amount:100,allocations:[],reserve:10,remainder:90},{type:'income',date:'2026-08-02',amount:50,allocations:[],reserve:5,remainder:45},{type:'expense',date:'2026-08-03',amount:20}]);
  const s=core.monthStats(pr,'2026-08'); assert.equal(s.income,150); assert.equal(s.reserve,15); assert.equal(s.free,115); assert.equal(s.operationCount,3);
});