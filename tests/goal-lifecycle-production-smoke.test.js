const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const {extractManifest}=require('../scripts/build-standalone-preview.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');
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

async function boot(){
  const dom=new JSDOM(shell,{url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true});
  dom.window.alert=()=>{};
  dom.window.confirm=()=>true;
  const context=dom.getInternalVMContext();
  execute(context,effectiveShellScript(),'app-shell-effective.js');
  execute(context,`globalThis.__ARISE_LEGACY_FINANCIAL_STRIPPED__=true; state.account.registered=true; state.account.name='QA'; saveState();`,'seed-account.js');
  const manifest=extractManifest(index);
  for(const source of manifest.scripts){
    if(/^https?:\/\//i.test(source))continue;
    const path=source.replace(/^\.\//,'');
    const result=execute(context,fs.readFileSync(path,'utf8'),path);
    if(result&&typeof result.then==='function')await result;
  }
  execute(context,`
    (()=>{
      const profile=activeProfile();
      profile.settings.reserve={...(profile.settings.reserve||{}),enabled:true};
      profile.goals=[
        {id:'done',name:'Отпуск',target:100000,current:100000,ledgerStart:100000,status:'completed',priority:5,monthlyContribution:12000,autoAllocate:false,completedAt:'2026-08-01'},
        {id:'next',name:'Техника',target:200000,current:0,ledgerStart:0,status:'active',priority:3,monthlyContribution:0,autoAllocate:false}
      ];
      profile.transactions=[];
      activePage='goals';
      render();
    })()
  `,'seed-goals.js');
  return {dom,context,document:dom.window.document};
}

test('production completed-goal actions open history, reroute and close workflows',async()=>{
  const {dom,context,document}=await boot();
  const row=document.querySelector('[data-completed-goal-id="done"]');
  assert.ok(row,'completed goal row missing');

  const history=row.querySelector('[data-goal-history="done"]');
  const reroute=row.querySelector('[data-goal-future-reroute="done"]');
  const close=row.querySelector('[data-close-completed-goal="done"]');
  assert.ok(history,'completed goal history action missing');
  assert.ok(reroute,'completed goal future-flow action missing');
  assert.ok(close,'completed goal close action missing');

  history.click();
  assert.equal(document.getElementById('modal').classList.contains('open'),true);
  assert.match(document.getElementById('sheet').textContent,/ИСТОРИЯ ЦЕЛИ/i);
  assert.match(document.getElementById('sheet').textContent,/Отпуск/);
  execute(context,'closeModal()','close-history.js');

  execute(context,"activePage='goals'; render();",'rerender-goals.js');
  document.querySelector('[data-goal-future-reroute="done"]').click();
  assert.ok(document.getElementById('goalFutureAmount'),'future-flow amount input missing');
  assert.ok(document.getElementById('goalFutureDestination'),'future-flow destination missing');
  execute(context,'closeModal()','close-reroute.js');

  execute(context,"activePage='goals'; render();",'rerender-before-close.js');
  document.querySelector('[data-close-completed-goal="done"]').click();
  assert.ok(document.getElementById('goalCloseDestination'),'funded completed goal close destination missing');
  assert.match(document.getElementById('sheet').textContent,/ARISE не удалит эти деньги/);

  dom.window.close();
});

test('production future-flow action persists rule by stable completed-goal id',async()=>{
  const {dom,context,document}=await boot();
  document.querySelector('[data-goal-future-reroute="done"]').click();
  document.getElementById('goalFutureAmount').value='12000';
  document.getElementById('goalFutureDestination').value='reserve';
  document.getElementById('saveGoalFutureRule').click();

  const rule=execute(context,`(()=>{const p=activeProfile();return ARISE_FINANCE_CORE.goalFutureRule(p,p.goals.find(g=>g.id==='done'));})()`,'read-rule.js');
  assert.equal(rule.monthlyAmount,12000);
  assert.equal(rule.destination,'reserve');

  const configured=document.querySelector('[data-completed-goal-id="done"] [data-goal-future-state]');
  assert.ok(configured,'configured future-flow state missing after save');
  assert.equal(configured.dataset.goalFutureState,'configured');
  assert.match(configured.textContent,/12000/);
  assert.match(configured.textContent,/резерв/);

  dom.window.close();
});
