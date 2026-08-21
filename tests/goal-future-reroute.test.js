const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function runtime(){
  const context=vm.createContext({console,globalThis:null,window:null,module:undefined});
  context.globalThis=context;context.window=context;
  for(const path of ['financial-core.js','goal-lifecycle-core.js','goal-future-reroute-core.js']){
    new vm.Script(fs.readFileSync(path,'utf8'),{filename:path}).runInContext(context);
  }
  return context.ARISE_FINANCE_CORE;
}

function baseProfile(){return {settings:{currency:'RUB',reserve:{enabled:false}},categories:[],goals:[],transactions:[]};}

function uiRuntime(){
  const dom=new JSDOM('<!doctype html><div id="page"></div><div id="sheet"></div>');
  const profile={
    settings:{currency:'RUB',reserve:{enabled:true}},categories:[],transactions:[],
    goals:[
      {id:'first',name:'Первый взнос',target:900000,status:'completed'},
      {id:'trip',name:'Путешествие',target:180000,status:'completed'}
    ]
  };
  const rules={first:{destination:'reserve',monthlyAmount:12000}};
  const core={
    setGoalFutureRule(){},clearGoalFutureRule(){},
    goalFutureRule:(p,goal)=>rules[goal.id]||null,
    goalBalance:()=>0,
    goalRemaining:()=>0
  };
  const ctx={
    console,globalThis:null,window:null,document:dom.window.document,ARISE_FINANCE_CORE:core,
    activeProfile:()=>profile,money:value=>`${value} ₽`,escapeHTML:value=>String(value??''),formatDate:value=>String(value??''),today:()=>"2026-08-21",uid:()=>"id",
    renderGoals:()=>{dom.window.document.getElementById('page').innerHTML='<section class="v3-section" data-completed-goals><div class="v3-section-title"><span>Достигнутые</span></div><div class="v3-rule" data-completed-goal-id="trip"><div><strong>Путешествие</strong></div><b>180000 ₽</b></div><div class="v3-rule" data-completed-goal-id="first"><div><strong>Первый взнос</strong></div><b>900000 ₽</b></div></section>';},
    openModal:()=>{},closeModal:()=>{},saveState:()=>{},toast:()=>{},render:()=>{},historyTransaction:()=>''
  };
  ctx.globalThis=ctx;ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('goal-lifecycle-ui.js','utf8'),ctx,{filename:'goal-lifecycle-ui.js'});
  return {ctx,dom};
}

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

test('loader keeps future reroute core before lifecycle UI and retires standalone reroute UI',()=>{
  const index=fs.readFileSync('index.html','utf8');
  const lifecycleCore=index.indexOf('./goal-lifecycle-core.js');
  const rerouteCore=index.indexOf('./goal-future-reroute-core.js');
  const expense=index.indexOf('./expense-reconciliation.js');
  const lifecycleUi=index.indexOf('./goal-lifecycle-ui.js');
  const modal=index.indexOf('./modal-accessibility.js');
  assert.ok(lifecycleCore>=0&&rerouteCore>lifecycleCore&&expense>rerouteCore);
  assert.ok(lifecycleUi>=0&&modal>lifecycleUi);
  assert.equal(index.includes('./goal-future-reroute-ui.js'),false);
  assert.equal(fs.existsSync('goal-future-reroute-ui.js'),false);
  const lifecycleSource=fs.readFileSync('goal-lifecycle-ui.js','utf8');
  assert.doesNotThrow(()=>new Function(lifecycleSource));
  assert.match(lifecycleSource,/ARISE_GOAL_FUTURE_REROUTE_UI/);
});

test('completed goals show explicit future-flow state and bind actions by stable goal id',()=>{
  const {ctx,dom}=uiRuntime();
  ctx.renderGoals();
  const configured=dom.window.document.querySelector('[data-completed-goal-id="first"]');
  const pending=dom.window.document.querySelector('[data-completed-goal-id="trip"]');
  assert.equal(configured.querySelector('[data-goal-future-state]').dataset.goalFutureState,'configured');
  assert.match(configured.textContent,/Следующий поток/);
  assert.match(configured.textContent,/12000 ₽ \/ мес\. → в резерв/);
  assert.equal(configured.querySelector('[data-goal-future-reroute]').textContent,'Изменить маршрут');
  assert.equal(configured.querySelector('[data-goal-future-reroute]').dataset.goalFutureReroute,'first');
  assert.equal(pending.querySelector('[data-goal-future-state]').dataset.goalFutureState,'pending');
  assert.match(pending.textContent,/Прежний ежемесячный взнос не закреплён/);
  assert.equal(pending.querySelector('[data-goal-future-reroute]').textContent,'Настроить следующий поток');
  assert.match(dom.window.document.querySelector('.goal-future-pending').textContent,/не резервирует прежний ежемесячный взнос/);
  dom.window.close();
});
