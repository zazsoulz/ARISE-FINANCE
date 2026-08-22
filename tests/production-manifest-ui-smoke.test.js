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

async function bootProductionRuntime(){
  const dom=new JSDOM(shell,{url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom;
  window.alert=()=>{};
  window.confirm=()=>true;
  const context=dom.getInternalVMContext();

  execute(context,effectiveShellScript(),'app-shell-effective.js');
  execute(context,`globalThis.__ARISE_LEGACY_FINANCIAL_STRIPPED__=true; state.account.registered=true; state.account.name='QA'; state.account.email='qa@example.com'; saveState();`,'seed-state.js');

  const manifest=extractManifest(index);
  for(const source of manifest.scripts){
    if(/^https?:\/\//i.test(source))continue;
    const path=source.replace(/^\.\//,'');
    const result=execute(context,fs.readFileSync(path,'utf8'),path);
    if(result&&typeof result.then==='function')await result;
  }

  return {dom,context,manifest};
}

test('production runtime manifest boots the five-section product shell',async()=>{
  const {dom,manifest}=await bootProductionRuntime();
  const document=dom.window.document;

  assert.ok(manifest.scripts.includes('./product-ui.js'));
  assert.ok(manifest.scripts.includes('./financial-bootstrap.js'));
  assert.equal(manifest.scripts.at(-1),'./financial-bootstrap.js');

  const nav=[...document.querySelectorAll('.product-nav [data-page]')];
  assert.deepEqual(nav.map(button=>button.dataset.page),['home','income','goals','history','analytics']);
  assert.deepEqual(nav.map(button=>button.textContent.trim()),['Главная','Распределение','Цели','История','Аналитика']);
  assert.ok(document.querySelector('.product-topbar'));
  assert.ok(document.querySelector('.product-sync'));
  assert.ok(document.querySelector('.product-avatar[data-page="settings"]'));
  assert.ok(document.querySelector('[data-quick-income]'));
  assert.ok(document.querySelector('[data-quick-expense]'));

  dom.window.close();
});

test('production shell primary navigation and quick actions are live',async()=>{
  const {dom,context}=await bootProductionRuntime();
  const document=dom.window.document;

  for(const page of ['income','goals','history','analytics','home']){
    const button=document.querySelector(`.product-nav [data-page="${page}"]`);
    assert.ok(button,`${page} navigation button missing`);
    button.click();
    assert.equal(execute(context,'activePage',`active-${page}.js`),page,`${page} navigation did not update activePage`);
    assert.ok(document.querySelector(`.product-nav [data-page="${page}"].active`),`${page} navigation did not render active state`);
  }

  document.querySelector('[data-quick-income]').click();
  assert.equal(document.getElementById('modal').classList.contains('open'),true,'income quick action did not open modal');
  assert.ok(document.getElementById('incomeAmount'),'income modal content missing');
  execute(context,'closeModal()','close-income.js');

  document.querySelector('[data-quick-expense]').click();
  assert.equal(document.getElementById('modal').classList.contains('open'),true,'expense quick action did not open modal');
  assert.ok(document.getElementById('expenseAmount'),'expense modal content missing');
  execute(context,'closeModal()','close-expense.js');

  const avatar=document.querySelector('.product-avatar[data-page="settings"]');
  avatar.click();
  assert.equal(execute(context,'activePage','active-settings.js'),'settings','profile/settings action is dead');
  assert.ok(document.getElementById('saveProfileSettings'),'settings screen did not render');

  dom.window.close();
});
