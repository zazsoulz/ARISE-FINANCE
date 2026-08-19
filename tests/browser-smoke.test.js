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

function execute(context,source,filename='inline.js'){
  return new vm.Script(source,{filename}).runInContext(context);
}

function executeFile(context,path){
  return execute(context,fs.readFileSync(path,'utf8'),path);
}

function boot({registered=false}={}){
  const dom=new JSDOM(shell,{url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom;
  window.alert=()=>{};
  window.confirm=()=>true;
  const context=dom.getInternalVMContext();
  execute(context,effectiveShellScript(),'app-shell-effective.js');

  if(registered){
    execute(context,`state.account.registered=true; state.account.name='QA'; state.account.email='qa@example.com'; saveState();`,'seed-state.js');
  }

  executeFile(context,'financial-core.js');
  executeFile(context,'financial-runtime.js');
  executeFile(context,'financial-integration.js');
  executeFile(context,'product-rules.js');
  executeFile(context,'financial-bootstrap.js');
  return {dom,context};
}

test('new user boots into registration instead of a blank or app screen',()=>{
  const {dom}=boot();
  assert.ok(dom.window.document.getElementById('registerSubmit'));
  assert.equal(dom.window.document.querySelector('.login-logo')?.textContent.includes('ARISE'),true);
  dom.window.close();
});

test('registered user boots into the financial app',()=>{
  const {dom}=boot({registered:true});
  assert.ok(dom.window.document.getElementById('homeIncome'));
  assert.ok(dom.window.document.getElementById('homeExpense'));
  assert.ok(dom.window.document.getElementById('homeGoal'));
  assert.equal(dom.window.document.querySelector('.logo')?.textContent.includes('ARISE'),true);
  assert.equal([...dom.window.document.querySelectorAll('.stat-label')].some(el=>el.textContent.trim()==='НЕ РАСПРЕДЕЛЕНО'),true);
  dom.window.close();
});

test('registered runtime uses the new core planner with goal allocations',()=>{
  const {dom,context}=boot({registered:true});
  const plan=execute(context,`
    (()=>{
      const profile=activeProfile();
      const g=createGoal({name:'Отпуск',target:100000,current:0,priority:5,deadline:'2026-12-31',monthlyContribution:20000});
      profile.goals.push(g);
      return calculateIncomePlan(profile,50000,'2026-08-19');
    })()
  `,'planner-smoke.js');
  assert.equal(plan.valid,true);
  assert.equal(plan.goalAllocations.length,1);
  assert.equal(plan.goalAllocations[0].name,'Отпуск');
  const accounted=plan.allocations.reduce((s,a)=>s+a.amount,0)+plan.goalAllocations.reduce((s,a)=>s+a.amount,0)+plan.reserve+plan.remainder;
  assert.equal(accounted,50000);
  dom.window.close();
});

test('unallocated balance is not a category and category names are unrestricted',()=>{
  const {dom,context}=boot({registered:true});
  const result=execute(context,`
    (()=>{
      const profile=activeProfile();
      profile.categories=[{id:'user-free',name:'Свободные деньги',type:'fixed',fixedAmount:400,percent:0,priority:3,limit:null,enabled:true}];
      profile.transactions=[{
        id:'income-1',type:'income',date:'2026-08-19',month:'2026-08',amount:1000,currency:'RUB',
        allocations:[{categoryId:'user-free',name:'Свободные деньги',amount:400,fixed:true,percent:0}],
        goalAllocations:[],reserve:0,remainder:600
      }];
      const stats=monthStats(profile,'2026-08');
      return {categoryValue:stats.allocations['Свободные деньги'],unallocated:stats.unallocated,keys:Object.keys(stats.allocations)};
    })()
  `,'unallocated-smoke.js');
  assert.equal(result.categoryValue,400);
  assert.equal(result.unallocated,600);
  assert.deepEqual([...result.keys],['Свободные деньги']);
  dom.window.close();
});

test('user can create edit and delete every category',()=>{
  const {dom,context}=boot({registered:true});
  execute(context,`activePage='settings'; render();`,'open-settings.js');

  const document=dom.window.document;
  const first=document.querySelector('[data-category-editor]');
  assert.ok(first,'starter category editor missing');
  assert.ok(first.querySelector('.category-name'));
  assert.ok(first.querySelector('.category-type'));
  assert.ok(first.querySelector('.category-percent'));
  assert.ok(first.querySelector('.category-fixed'));
  assert.ok(first.querySelector('.category-priority'));
  assert.ok(first.querySelector('.category-limit'));
  assert.ok(first.querySelector('.category-enabled'));
  assert.ok(first.querySelector('[data-delete-category]'));

  first.querySelector('.category-name').value='Полностью моя';
  first.querySelector('.category-type').value='fixed';
  first.querySelector('.category-fixed').value='12345';
  first.querySelector('.category-percent').value='35';
  first.querySelector('.category-priority').value='2';
  first.querySelector('.category-limit').value='50000';
  first.querySelector('.category-enabled').checked=false;
  document.getElementById('saveCategories').click();

  const edited=execute(context,`(()=>{const c=activeProfile().categories[0]; return {name:c.name,type:c.type,fixedAmount:c.fixedAmount,percent:c.percent,priority:c.priority,limit:c.limit,enabled:c.enabled};})()`,'read-category.js');
  assert.deepEqual({...edited},{name:'Полностью моя',type:'fixed',fixedAmount:12345,percent:35,priority:2,limit:50000,enabled:false});

  const beforeAdd=execute(context,'activeProfile().categories.length','before-add.js');
  document.getElementById('addCategory').click();
  const afterAdd=execute(context,'activeProfile().categories.length','after-add.js');
  assert.equal(afterAdd,beforeAdd+1);

  let guard=20;
  while(execute(context,'activeProfile().categories.length','category-count.js')>0&&guard-->0){
    const deleteButton=document.querySelector('[data-delete-category]');
    assert.ok(deleteButton,'delete button missing');
    deleteButton.click();
  }
  assert.equal(execute(context,'activeProfile().categories.length','final-category-count.js'),0);
  dom.window.close();
});
