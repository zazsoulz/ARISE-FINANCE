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

function boot(){
  const dom=new JSDOM(shell,{url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom;
  window.alert=()=>{};
  window.confirm=()=>true;
  const context=dom.getInternalVMContext();
  execute(context,effectiveShellScript(),'app-shell-effective.js');
  execute(context,`state.account.registered=true; state.account.name='QA'; state.account.email='qa@example.com'; saveState();`,'seed-state.js');
  for(const path of ['financial-core.js','financial-runtime.js','financial-integration.js','product-rules.js','arise-v3.js','analytics-engine.js','analytics-ui.js','financial-bootstrap.js']){
    execute(context,fs.readFileSync(path,'utf8'),path);
  }
  return {dom,context};
}

test('financial profiles keep categories goals transactions and balances isolated',()=>{
  const {dom,context}=boot();
  const result=execute(context,`
    (()=>{
      const first=activeProfile();
      first.name='Первый';
      first.categories=[{id:'first-cat',name:'Первый бюджет',type:'fixed',fixedAmount:300,percent:0,priority:5,limit:null,enabled:true}];
      first.goals=[createGoal({name:'Первая цель',target:1000,current:100,priority:3,monthlyContribution:0})];
      first.transactions=[{
        id:'first-income',type:'income',date:'2026-08-19',month:'2026-08',amount:1000,currency:'RUB',
        allocations:[{categoryId:'first-cat',name:'Первый бюджет',amount:300,fixed:true,percent:0}],
        goalAllocations:[],reserve:0,remainder:700
      }];

      const second=createProfile('Второй');
      second.categories=[{id:'second-cat',name:'Второй бюджет',type:'fixed',fixedAmount:200,percent:0,priority:5,limit:null,enabled:true}];
      second.goals=[];
      second.transactions=[{
        id:'second-income',type:'income',date:'2026-08-19',month:'2026-08',amount:500,currency:'RUB',
        allocations:[{categoryId:'second-cat',name:'Второй бюджет',amount:200,fixed:true,percent:0}],
        goalAllocations:[],reserve:0,remainder:300
      }];
      state.profiles.push(second);

      state.activeProfileId=first.id;
      const firstStats=ARISE_V3.groupMonth(activeProfile(),'2026-08');
      const firstSnapshot={
        id:activeProfile().id,
        income:firstStats.income,
        unallocated:firstStats.unallocated,
        categories:activeProfile().categories.map(item=>item.name),
        goals:activeProfile().goals.map(item=>item.name),
        transactions:activeProfile().transactions.map(item=>item.id)
      };

      switchProfile(second.id);
      const secondStats=ARISE_V3.groupMonth(activeProfile(),'2026-08');
      const secondSnapshot={
        id:activeProfile().id,
        income:secondStats.income,
        unallocated:secondStats.unallocated,
        categories:activeProfile().categories.map(item=>item.name),
        goals:activeProfile().goals.map(item=>item.name),
        transactions:activeProfile().transactions.map(item=>item.id)
      };

      const firstAfter=state.profiles.find(profile=>profile.id===first.id);
      const firstAfterStats=ARISE_V3.groupMonth(firstAfter,'2026-08');
      return {
        first:firstSnapshot,
        second:secondSnapshot,
        firstAfter:{
          income:firstAfterStats.income,
          unallocated:firstAfterStats.unallocated,
          categories:firstAfter.categories.map(item=>item.name),
          goals:firstAfter.goals.map(item=>item.name),
          transactions:firstAfter.transactions.map(item=>item.id)
        }
      };
    })()
  `,'profile-isolation.js');

  assert.equal(result.first.income,1000);
  assert.equal(result.first.unallocated,700);
  assert.deepEqual([...result.first.categories],['Первый бюджет']);
  assert.deepEqual([...result.first.goals],['Первая цель']);
  assert.deepEqual([...result.first.transactions],['first-income']);

  assert.equal(result.second.income,500);
  assert.equal(result.second.unallocated,300);
  assert.deepEqual([...result.second.categories],['Второй бюджет']);
  assert.deepEqual([...result.second.goals],[]);
  assert.deepEqual([...result.second.transactions],['second-income']);
  assert.notEqual(result.first.id,result.second.id);

  assert.equal(result.firstAfter.income,1000);
  assert.equal(result.firstAfter.unallocated,700);
  assert.deepEqual([...result.firstAfter.categories],['Первый бюджет']);
  assert.deepEqual([...result.firstAfter.goals],['Первая цель']);
  assert.deepEqual([...result.firstAfter.transactions],['first-income']);

  dom.window.close();
});
