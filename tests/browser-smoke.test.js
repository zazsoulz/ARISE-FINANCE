const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
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

function executeFile(window,path){
  window.eval(fs.readFileSync(path,'utf8'));
}

function boot({registered=false}={}){
  const dom=new JSDOM(shell,{url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom;
  window.alert=()=>{};
  window.confirm=()=>true;
  window.eval(effectiveShellScript());

  if(registered){
    window.eval(`state.account.registered=true; state.account.name='QA'; state.account.email='qa@example.com'; saveState();`);
  }

  executeFile(window,'financial-core.js');
  executeFile(window,'financial-runtime.js');
  executeFile(window,'financial-integration.js');
  executeFile(window,'financial-bootstrap.js');
  return dom;
}

test('new user boots into registration instead of a blank or app screen',()=>{
  const dom=boot();
  assert.ok(dom.window.document.getElementById('registerSubmit'));
  assert.equal(dom.window.document.querySelector('.login-logo')?.textContent.includes('ARISE'),true);
  dom.window.close();
});

test('registered user boots into the financial app',()=>{
  const dom=boot({registered:true});
  assert.ok(dom.window.document.getElementById('homeIncome'));
  assert.ok(dom.window.document.getElementById('homeExpense'));
  assert.ok(dom.window.document.getElementById('homeGoal'));
  assert.equal(dom.window.document.querySelector('.logo')?.textContent.includes('ARISE'),true);
  dom.window.close();
});

test('registered runtime uses the new core planner with goal allocations',()=>{
  const dom=boot({registered:true});
  const plan=dom.window.eval(`
    (()=>{
      const profile=activeProfile();
      const g=createGoal({name:'Отпуск',target:100000,current:0,priority:5,deadline:'2026-12-31',monthlyContribution:20000});
      profile.goals.push(g);
      return calculateIncomePlan(profile,50000,'2026-08-19');
    })()
  `);
  assert.equal(plan.valid,true);
  assert.equal(plan.goalAllocations.length,1);
  assert.equal(plan.goalAllocations[0].name,'Отпуск');
  const accounted=plan.allocations.reduce((s,a)=>s+a.amount,0)+plan.goalAllocations.reduce((s,a)=>s+a.amount,0)+plan.reserve+plan.remainder;
  assert.equal(accounted,50000);
  dom.window.close();
});
