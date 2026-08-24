const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

const shell=fs.readFileSync('app-shell.html','utf8');
const financialMarker=`/* =========================================================\n   FINANCIAL ENGINE\n========================================================= */`;
const uiMarker=`/* =========================================================\n   UI\n========================================================= */`;
const initMarker=`/* =========================================================\n   INITIALIZATION\n========================================================= */`;

function shellScript(){
  const scripts=[...shell.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  let source=scripts[0][1];
  const financialStart=source.indexOf(financialMarker),uiStart=source.indexOf(uiMarker);
  source=source.slice(0,financialStart)+source.slice(uiStart);
  return source.slice(0,source.indexOf(initMarker));
}
function run(context,source,name='inline.js'){return new vm.Script(source,{filename:name}).runInContext(context);}
function file(context,path){return run(context,fs.readFileSync(path,'utf8'),path);}
function boot(){
  const dom=new JSDOM(shell,{url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true});
  dom.window.alert=()=>{};dom.window.confirm=()=>true;
  const context=dom.getInternalVMContext();
  run(context,shellScript(),'effective-shell.js');
  run(context,`state.account.registered=true; state.account.name='QA'; state.account.email='qa@example.com'; saveState();`,'seed-account.js');
  for(const path of ['financial-core.js','expense-reconciliation.js','financial-runtime.js','financial-integration.js','reserve-analytics.js','product-rules.js','navigation-compat.js','arise-v3.js','analytics-engine.js','analytics-ui.js','history-inspector.js','settings-ui.js','financial-bootstrap.js'])file(context,path);
  return {dom,context};
}

function seed(context){
  run(context,`(()=>{
    const profile=activeProfile();
    profile.categories=[{id:'life',name:'На жизнь',type:'fixed',fixedAmount:50000,percent:0,priority:3,limit:null,enabled:true}];
    profile.goals=[{id:'trip',name:'Отпуск',target:100000,current:0,ledgerStart:0,priority:4,status:'completed',currency:'RUB'}];
    profile.transactions=[
      {id:'july',type:'income',date:'2026-07-10',month:'2026-07',amount:40000,currency:'RUB',source:'Работа 2',allocations:[],goalAllocations:[],reserve:0,remainder:40000},
      {id:'aug-income',type:'income',date:'2026-08-10',month:'2026-08',amount:60000,currency:'RUB',source:'Работа 1',allocations:[{categoryId:'life',name:'На жизнь',amount:30000,fixed:true}],goalAllocations:[],reserve:0,remainder:30000},
      {id:'aug-expense',type:'expense',date:'2026-08-12',month:'2026-08',amount:12000,currency:'RUB',source:'Кофе и продукты',categoryId:'life',categoryName:'На жизнь',fundingSource:'category',controlledAmount:12000,uncontrolledAmount:0,note:'Покупки'},
      {id:'aug-goal',type:'goal_contribution',date:'2026-08-13',month:'2026-08',amount:5000,currency:'RUB',goalId:'trip',goalName:'Отпуск',sourceAccount:'unallocated'}
    ];
    activeMonth='2026-08';activePage='history';render();
  })()`,'seed-history.js');
}

test('history exposes canonical filters without mutating ledger data',()=>{
  const {dom,context}=boot();seed(context);const document=dom.window.document;
  assert.ok(document.querySelector('.history-filter-panel'));
  assert.equal(document.querySelectorAll('[data-history-filter]').length,6);
  assert.equal(document.querySelectorAll('[data-history-tx]').length,3);
  const before=run(context,'JSON.stringify(activeProfile().transactions)','before.js');
  const type=document.querySelector('[data-history-filter="type"]');
  type.value='expense';type.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.equal(document.querySelectorAll('[data-history-tx]').length,1);
  assert.match(document.querySelector('.v3-transactions').textContent,/Кофе|12/);
  const after=run(context,'JSON.stringify(activeProfile().transactions)','after.js');
  assert.equal(after,before);
  dom.window.close();
});

test('history filters reset when financial profile changes',()=>{
  const {dom,context}=boot();seed(context);let document=dom.window.document;
  const category=document.querySelector('[data-history-filter="category"]');
  category.value='life';category.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.equal(run(context,'ARISE_HISTORY_INSPECTOR.state.category','filter-a.js'),'life');
  run(context,`(()=>{
    const second=createProfile('Второй');
    second.categories=[{id:'food',name:'Еда',type:'percent',percent:20,priority:2,limit:null,enabled:true}];
    second.transactions=[{id:'second-expense',type:'expense',date:'2026-08-15',month:'2026-08',amount:3000,currency:'RUB',source:'Магазин',categoryId:'food',categoryName:'Еда',controlledAmount:3000,uncontrolledAmount:0}];
    state.profiles.push(second);state.activeProfileId=second.id;activePage='history';activeMonth='2026-08';render();
  })()`,'switch-profile.js');
  document=dom.window.document;
  assert.equal(run(context,'ARISE_HISTORY_INSPECTOR.state.category','filter-b.js'),'all');
  assert.equal(document.querySelectorAll('[data-history-tx]').length,1);
  assert.match(document.querySelector('.v3-transactions').textContent,/Магазин|3/);
  dom.window.close();
});

test('history can switch to all-time scope and filter by completed goal',()=>{
  const {dom,context}=boot();seed(context);let document=dom.window.document;
  const scope=document.querySelector('[data-history-filter="scope"]');
  scope.value='all';scope.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  document=dom.window.document;
  assert.equal(document.querySelectorAll('[data-history-tx]').length,4);
  const goal=document.querySelector('[data-history-filter="goal"]');
  assert.ok([...goal.options].some(option=>option.value==='__completed__'));
  goal.value='__completed__';goal.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.equal(document.querySelectorAll('[data-history-tx]').length,1);
  assert.match(document.querySelector('.v3-transactions').textContent,/Отпуск|5/);
  dom.window.close();
});

test('history transaction inspector shows funding reconciliation details',()=>{
  const {dom,context}=boot();seed(context);const document=dom.window.document;
  const type=document.querySelector('[data-history-filter="type"]');
  type.value='expense';type.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  document.querySelector('[data-history-tx]').click();
  const sheet=document.getElementById('sheet');
  assert.match(sheet.textContent,/Расход/);
  assert.match(sheet.textContent,/Контролируемая часть/);
  assert.match(sheet.textContent,/12[\s\u00a0]?000/);
  assert.match(sheet.textContent,/На жизнь/);
  assert.match(sheet.textContent,/Покупки/);
  dom.window.close();
});
