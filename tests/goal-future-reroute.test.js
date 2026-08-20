const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function runtime(){
  const context=vm.createContext({console,globalThis:null,window:null,module:undefined});
  context.globalThis=context;context.window=context;
  for(const path of ['financial-core.js','goal-lifecycle-core.js','goal-future-reroute-core.js']){
    new vm.Script(fs.readFileSync(path,'utf8'),{filename:path}).runInContext(context);
  }
  return context.ARISE_FINANCE_CORE;
}

function baseProfile(){return {settings:{currency:'RUB',reserve:{enabled:false}},categories:[],goals:[],transactions:[]};}

test('completed goal future money keeps its priority and is not consumed by lower priority rules',()=>{
  const core=runtime();
  const profile=baseProfile();
  const completed={id:'done',name:'Done',target:100,current:100,status:'completed',priority:5,monthlyContribution:100,ariseSync:{remoteId:'remote-done'}};
  profile.goals=[completed];
  profile.categories=[{id:'life',name:'Life',type:'percentage',percent:100,priority:1,enabled:true}];
  core.setGoalFutureRule(profile,completed,{destination:'free',monthlyAmount:100});
  const plan=core.planIncome(profile,1000,'2026-08-20');
  assert.equal(plan.remainder,100);
  assert.equal(plan.allocations.reduce((sum,item)=>sum+item.amount,0),900);
  assert.equal(plan.goalReroutes[0].amount,100);
  assert.equal(plan.goalReroutes[0].destination,'free');
});

test('future reroute monthly amount is applied only once across multiple incomes',()=>{
  const core=runtime();
  const profile=baseProfile();
  const completed={id:'done',target:100,current:100,status:'completed',priority:5,monthlyContribution:100};
  profile.goals=[completed];
  core.setGoalFutureRule(profile,completed,{destination:'free',monthlyAmount:100});
  const first=core.planIncome(profile,500,'2026-08-10');
  const tx=core.createIncomeTransaction({...first,id:'income-1',currency:'RUB'});
  profile.transactions.push(tx);
  const second=core.planIncome(profile,500,'2026-08-20');
  assert.equal(first.goalReroutes.reduce((sum,item)=>sum+item.amount,0),100);
  assert.equal(second.goalReroutes.length,0);
});

test('category destination respects monthly limit and parks excess in free remainder',()=>{
  const core=runtime();
  const profile=baseProfile();
  const completed={id:'done',target:100,current:100,status:'completed',priority:5};
  const category={id:'cat',name:'Next',type:'percentage',percent:0,priority:1,enabled:true,limit:150};
  profile.goals=[completed];profile.categories=[category];
  core.setGoalFutureRule(profile,completed,{destination:'category:cat',monthlyAmount:200});
  const plan=core.planIncome(profile,500,'2026-08-20');
  assert.equal(plan.allocations.length,1);
  assert.equal(plan.allocations[0].amount,150);
  assert.equal(plan.remainder,350);
  assert.equal(plan.goalReroutes[0].appliedAmount,150);
  assert.equal(plan.goalReroutes[0].fallbackAmount,50);
});

test('goal destination never exceeds target capacity',()=>{
  const core=runtime();
  const profile=baseProfile();
  const completed={id:'done',target:100,current:100,status:'completed',priority:5};
  const target={id:'target',name:'Target',target:80,current:0,status:'active',priority:2,monthlyContribution:0,autoAllocate:false};
  profile.goals=[completed,target];
  core.setGoalFutureRule(profile,completed,{destination:'goal:target',monthlyAmount:100});
  const plan=core.planIncome(profile,500,'2026-08-20');
  assert.equal(plan.goalAllocations.length,1);
  assert.equal(plan.goalAllocations[0].amount,80);
  assert.equal(plan.remainder,420);
  assert.equal(plan.goalReroutes[0].fallbackAmount,20);
});

test('future rule survives cross-device local ids through remote ids in profile settings',()=>{
  const core=runtime();
  const profile=baseProfile();
  const source={id:'local-source-a',status:'completed',ariseSync:{remoteId:'remote-source'}};
  const target={id:'local-target-a',status:'active',target:1000,current:0,ariseSync:{remoteId:'remote-target'}};
  profile.goals=[source,target];
  core.setGoalFutureRule(profile,source,{destination:'goal:local-target-a',monthlyAmount:75});
  assert.equal(profile.settings.goalFutureReroutes['remote-source'].destination,'goal:remote-target');

  const other={settings:JSON.parse(JSON.stringify(profile.settings)),categories:[],transactions:[],goals:[
    {id:'local-source-b',status:'completed',ariseSync:{remoteId:'remote-source'}},
    {id:'local-target-b',status:'active',target:1000,current:0,ariseSync:{remoteId:'remote-target'}}
  ]};
  const rule=core.goalFutureRule(other,other.goals[0]);
  assert.equal(rule.monthlyAmount,75);
  assert.equal(rule.destination,'goal:local-target-b');
});

test('income transaction persists reroute provenance inside existing funding breakdown payload',()=>{
  const core=runtime();
  const plan={valid:true,total:500,allocations:[],goalAllocations:[],reserve:0,remainder:400,goalReroutes:[{fromGoalId:'done',fromGoalRemoteId:'remote-done',destination:'free',amount:100,appliedAmount:0,fallbackAmount:100}],date:'2026-08-20',month:'2026-08'};
  const tx=core.createIncomeTransaction({...plan,id:'income-1',currency:'RUB'});
  assert.equal(tx.goalReroutes[0].amount,100);
  assert.equal(tx.fundingBreakdown.goalReroutes[0].fromGoalRemoteId,'remote-done');
});

test('loader keeps future reroute core and UI in canonical order',()=>{
  const index=fs.readFileSync('index.html','utf8');
  const lifecycleCore=index.indexOf('./goal-lifecycle-core.js');
  const rerouteCore=index.indexOf('./goal-future-reroute-core.js');
  const expense=index.indexOf('./expense-reconciliation.js');
  const lifecycleUi=index.indexOf('./goal-lifecycle-ui.js');
  const rerouteUi=index.indexOf('./goal-future-reroute-ui.js');
  const modal=index.indexOf('./modal-accessibility.js');
  assert.ok(lifecycleCore>=0&&rerouteCore>lifecycleCore&&expense>rerouteCore);
  assert.ok(lifecycleUi>=0&&rerouteUi>lifecycleUi&&modal>rerouteUi);
  assert.doesNotThrow(()=>new Function(fs.readFileSync('goal-future-reroute-ui.js','utf8')));
});
