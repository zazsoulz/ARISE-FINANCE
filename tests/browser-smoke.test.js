const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

const shell=fs.readFileSync('app-shell.html','utf8');
const financialMarker=`/* =========================================================\n   FINANCIAL ENGINE\n========================================================= */`;
const uiMarker=`/* =========================================================\n   UI\n========================================================= */`;
const initMarker=`/* =========================================================\n   INITIALIZATION\n========================================================= */`;

function effectiveShellScript(){
  const scripts=[...shell.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length,1,'expected one inline shell script');
  let source=scripts[0][1];
  const financialStart=source.indexOf(financialMarker);
  const uiStart=source.indexOf(uiMarker);
  assert.ok(financialStart>=0&&uiStart>financialStart);
  source=source.slice(0,financialStart)+source.slice(uiStart);
  const initStart=source.indexOf(initMarker);
  assert.ok(initStart>=0);
  return source.slice(0,initStart);
}
function execute(context,source,filename='inline.js'){return new vm.Script(source,{filename}).runInContext(context);}
function executeFile(context,path){return execute(context,fs.readFileSync(path,'utf8'),path);}
function boot({registered=false}={}){
  const dom=new JSDOM(shell,{url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom; window.alert=()=>{}; window.confirm=()=>true;
  const context=dom.getInternalVMContext(); execute(context,effectiveShellScript(),'app-shell-effective.js');
  if(registered) execute(context,`state.account.registered=true; state.account.name='QA'; state.account.email='qa@example.com'; saveState();`,'seed-state.js');
  for(const path of ['financial-core.js','expense-reconciliation.js','financial-runtime.js','financial-integration.js','reserve-analytics.js','product-rules.js','navigation-compat.js','arise-v3.js','analytics-engine.js','analytics-ui.js','settings-ui.js','financial-bootstrap.js']) executeFile(context,path);
  return {dom,context};
}

test('new user boots into registration instead of a blank or app screen',()=>{
  const {dom}=boot(); assert.ok(dom.window.document.getElementById('registerSubmit')); assert.equal(dom.window.document.querySelector('.login-logo')?.textContent.includes('ARISE'),true); dom.window.close();
});

test('registered user boots into A1-V3 financial flow',()=>{
  const {dom}=boot({registered:true}); const document=dom.window.document;
  assert.ok(document.querySelector('.arise-v3-home')); assert.ok(document.querySelector('.arise-flow-stage')); assert.ok(document.querySelector('.arise-remainder')); assert.ok(document.getElementById('homeIncome'));
  assert.equal(document.querySelector('.logo')?.textContent.includes('ARISE'),true);
  assert.deepEqual([...document.querySelectorAll('.nav [data-page]')].map(el=>el.dataset.page),['home','income','goals','history','analytics']);
  assert.equal([...document.querySelectorAll('.arise-flow-node')].length,4); dom.window.close();
});

test('A1-V3 distribution goals and history screens render',()=>{
  const {dom,context}=boot({registered:true}); const document=dom.window.document;
  execute(context,`activePage='income'; render();`,'distribution-screen.js'); assert.ok(document.querySelector('.arise-v3-distribution')); assert.ok(document.querySelector('.v3-summary-measure')); assert.ok(document.getElementById('incomeStart')); assert.ok(document.getElementById('incomeSettings'));
  execute(context,`activePage='goals'; render();`,'goals-screen.js'); assert.ok(document.querySelector('.arise-v3-goals')); assert.ok(document.getElementById('createGoal'));
  execute(context,`activePage='history'; render();`,'history-screen.js'); assert.ok(document.querySelector('.arise-v3-history')); assert.ok(document.querySelector('.v3-history-chart')); assert.ok(document.querySelector('.v3-chart-current')); assert.ok(document.querySelector('.v3-breakdown-head')); assert.ok(document.getElementById('historyIncome')); assert.ok(document.getElementById('historyExpense'));
  dom.window.close();
});

test('A1-V3 flow reflects actual month money groups',()=>{
  const {dom,context}=boot({registered:true});
  const result=execute(context,`(()=>{const profile=activeProfile(); profile.categories=[{id:'fixed',name:'Обязательное',type:'fixed',fixedAmount:300,percent:0,priority:5,limit:null,enabled:true},{id:'life',name:'На жизнь',type:'percentage',fixedAmount:0,percent:20,priority:3,limit:null,enabled:true}]; profile.transactions=[{id:'i1',type:'income',date:'2026-08-19',month:'2026-08',amount:1000,currency:'RUB',allocations:[{categoryId:'fixed',name:'Обязательное',amount:300,fixed:true,percent:0},{categoryId:'life',name:'На жизнь',amount:200,fixed:false,percent:20}],goalAllocations:[],reserve:100,remainder:400}]; return ARISE_V3.groupMonth(profile,'2026-08');})()`,'flow-groups.js');
  assert.deepEqual({...result},{income:1000,expenses:0,fixed:300,categories:200,reserve:100,goals:0,unallocated:400}); dom.window.close();
});

test('registered runtime uses the core planner with goal allocations',()=>{
  const {dom,context}=boot({registered:true});
  const plan=execute(context,`(()=>{const profile=activeProfile(); const g=createGoal({name:'Отпуск',target:100000,current:0,priority:5,deadline:'2026-12-31',monthlyContribution:20000}); profile.goals.push(g); return calculateIncomePlan(profile,50000,'2026-08-19');})()`,'planner-smoke.js');
  assert.equal(plan.valid,true); assert.equal(plan.goalAllocations.length,1); assert.equal(plan.goalAllocations[0].name,'Отпуск');
  const accounted=plan.allocations.reduce((s,a)=>s+a.amount,0)+plan.goalAllocations.reduce((s,a)=>s+a.amount,0)+plan.reserve+plan.remainder; assert.equal(accounted,50000); dom.window.close();
});

test('uncategorized overspend persists controlled and uncontrolled funding explicitly',()=>{
  const {dom,context}=boot({registered:true});
  const result=execute(context,`(()=>{
    const profile=activeProfile();
    profile.transactions=[{id:'i1',type:'income',date:'2026-08-19',month:'2026-08',amount:20000,currency:'RUB',allocations:[],goalAllocations:[],reserve:0,remainder:20000}];
    const tx=createExpenseTransaction(profile,{amount:30000,date:'2026-08-19',categoryId:null,source:'Покупка',currency:'RUB'});
    const stats=monthStats(profile,'2026-08');
    return {fundingSource:tx.fundingSource,fundingSourceId:tx.fundingSourceId,controlledAmount:tx.controlledAmount,uncontrolledAmount:tx.uncontrolledAmount,free:stats.unallocated,uncontrolled:stats.uncontrolled};
  })()`,'expense-funding.js');
  assert.deepEqual({...result},{fundingSource:'unallocated',fundingSourceId:null,controlledAmount:20000,uncontrolledAmount:10000,free:0,uncontrolled:10000});
  dom.window.close();
});

test('categorized expense uses actual category balance and records overspend',()=>{
  const {dom,context}=boot({registered:true});
  const result=execute(context,`(()=>{
    const profile=activeProfile();
    profile.categories=[{id:'life',name:'На жизнь',type:'fixed',fixedAmount:20000,percent:0,priority:3,limit:null,enabled:true}];
    profile.transactions=[{id:'i1',type:'income',date:'2026-08-19',month:'2026-08',amount:20000,currency:'RUB',allocations:[{categoryId:'life',name:'На жизнь',amount:20000,fixed:true,percent:0}],goalAllocations:[],reserve:0,remainder:0}];
    const tx=createExpenseTransaction(profile,{amount:30000,date:'2026-08-19',categoryId:'life',categoryName:'На жизнь',source:'Покупка',currency:'RUB'});
    const stats=monthStats(profile,'2026-08');
    return {fundingSource:tx.fundingSource,fundingSourceId:tx.fundingSourceId,controlledAmount:tx.controlledAmount,uncontrolledAmount:tx.uncontrolledAmount,uncontrolled:stats.uncontrolled};
  })()`,'category-expense-funding.js');
  assert.deepEqual({...result},{fundingSource:'category',fundingSourceId:'life',controlledAmount:20000,uncontrolledAmount:10000,uncontrolled:10000});
  dom.window.close();
});

test('expense overspend requires explicit uncontrolled acceptance in the UI',()=>{
  const {dom,context}=boot({registered:true});
  execute(context,`(()=>{
    const profile=activeProfile();
    profile.transactions=[{id:'i1',type:'income',date:'2026-08-19',month:'2026-08',amount:20000,currency:'RUB',allocations:[],goalAllocations:[],reserve:0,remainder:20000}];
    showExpenseModal();
    const amount=document.getElementById('expenseAmount'); amount.value='30000'; amount.dispatchEvent(new Event('input',{bubbles:true}));
  })()`,'expense-reconciliation-ui.js');
  const document=dom.window.document;
  const save=document.getElementById('saveExpense');
  const accept=document.getElementById('acceptUncontrolledExpense');
  assert.ok(accept,'uncontrolled acceptance checkbox missing');
  assert.equal(save.disabled,true);
  assert.match(document.getElementById('expensePreview').textContent,/10[\s\u00a0]?000/);
  accept.checked=true;
  accept.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.equal(save.disabled,false);
  dom.window.close();
});

test('expense reconciliation clears when a selected source fully covers the amount',()=>{
  const {dom,context}=boot({registered:true});
  execute(context,`(()=>{
    const profile=activeProfile();
    profile.categories=[{id:'life',name:'На жизнь',type:'fixed',fixedAmount:30000,percent:0,priority:3,limit:null,enabled:true}];
    profile.transactions=[{id:'i1',type:'income',date:'2026-08-19',month:'2026-08',amount:30000,currency:'RUB',allocations:[{categoryId:'life',name:'На жизнь',amount:30000,fixed:true,percent:0}],goalAllocations:[],reserve:0,remainder:0}];
    showExpenseModal();
    const category=document.getElementById('expenseCategory'); category.value='life';
    const amount=document.getElementById('expenseAmount'); amount.value='20000';
    category.dispatchEvent(new Event('change',{bubbles:true})); amount.dispatchEvent(new Event('input',{bubbles:true}));
  })()`,'expense-reconciliation-covered-ui.js');
  const document=dom.window.document;
  assert.equal(document.getElementById('acceptUncontrolledExpense'),null);
  assert.equal(document.getElementById('saveExpense').disabled,false);
  assert.match(document.getElementById('expensePreview').textContent,/полностью покрывается/i);
  dom.window.close();
});

test('A1-V3 does not expose destructive deletion for a funded goal',()=>{
  const {dom,context}=boot({registered:true});
  execute(context,`(()=>{const profile=activeProfile(); const goal=createGoal({name:'Отпуск',target:100000,current:25000,priority:5,deadline:'2026-12-31',monthlyContribution:20000}); profile.goals=[goal]; activePage='goals'; render();})()`,'funded-goal.js');
  const document=dom.window.document;
  assert.ok(document.querySelector('.arise-v3-goals'));
  assert.equal(document.querySelector('[data-goal-delete]'),null);
  assert.equal(execute(context,'activeProfile().goals.length','funded-goal-count.js'),1);
  dom.window.close();
});

test('unallocated balance is not a category and category names are unrestricted',()=>{
  const {dom,context}=boot({registered:true});
  const result=execute(context,`(()=>{const profile=activeProfile(); profile.categories=[{id:'user-free',name:'Свободные деньги',type:'fixed',fixedAmount:400,percent:0,priority:3,limit:null,enabled:true}]; profile.transactions=[{id:'income-1',type:'income',date:'2026-08-19',month:'2026-08',amount:1000,currency:'RUB',allocations:[{categoryId:'user-free',name:'Свободные деньги',amount:400,fixed:true,percent:0}],goalAllocations:[],reserve:0,remainder:600}]; const stats=monthStats(profile,'2026-08'); return {categoryValue:stats.allocations['Свободные деньги'],unallocated:stats.unallocated,keys:Object.keys(stats.allocations)};})()`,'unallocated-smoke.js');
  assert.equal(result.categoryValue,400); assert.equal(result.unallocated,600); assert.deepEqual([...result.keys],['Свободные деньги']); dom.window.close();
});

test('user can create edit and delete every category',()=>{
  const {dom,context}=boot({registered:true}); execute(context,`activePage='settings'; render();`,'open-settings.js'); const document=dom.window.document;
  const first=document.querySelector('[data-category-editor]'); assert.ok(first,'starter category editor missing');
  for(const selector of ['.category-name','.category-type','.category-percent','.category-fixed','.category-priority','.category-limit','.category-enabled','[data-delete-category]']) assert.ok(first.querySelector(selector),selector+' missing');
  first.querySelector('.category-name').value='Полностью моя'; first.querySelector('.category-type').value='fixed'; first.querySelector('.category-fixed').value='12345'; first.querySelector('.category-percent').value='35'; first.querySelector('.category-priority').value='2'; first.querySelector('.category-limit').value='50000'; first.querySelector('.category-enabled').checked=false; document.getElementById('saveCategories').click();
  const edited=execute(context,`(()=>{const c=activeProfile().categories[0]; return {name:c.name,type:c.type,fixedAmount:c.fixedAmount,percent:c.percent,priority:c.priority,limit:c.limit,enabled:c.enabled};})()`,'read-category.js');
  assert.deepEqual({...edited},{name:'Полностью моя',type:'fixed',fixedAmount:12345,percent:35,priority:2,limit:50000,enabled:false});
  const beforeAdd=execute(context,'activeProfile().categories.length','before-add.js'); document.getElementById('addCategory').click(); assert.equal(execute(context,'activeProfile().categories.length','after-add.js'),beforeAdd+1);
  let guard=20; while(execute(context,'activeProfile().categories.length','category-count.js')>0&&guard-->0){const deleteButton=document.querySelector('[data-delete-category]'); assert.ok(deleteButton,'delete button missing'); deleteButton.click();}
  assert.equal(execute(context,'activeProfile().categories.length','final-category-count.js'),0); dom.window.close();
});
