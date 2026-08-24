const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const {extractManifest}=require('../scripts/build-standalone-preview.js');
const {removeNavigationCompatSource}=require('../scripts/remove-navigation-compat-source.js');

const originalShell=fs.readFileSync('app-shell.html','utf8');
const shell=removeNavigationCompatSource(originalShell);
const index=fs.readFileSync('index.html','utf8');
const financialMarker=`/* =========================================================\n   FINANCIAL ENGINE\n========================================================= */`;
const uiMarker=`/* =========================================================\n   UI\n========================================================= */`;
const initMarker=`/* =========================================================\n   INITIALIZATION\n========================================================= */`;

function effectiveShellScript(){
  const scripts=[...shell.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length,1,'expected one inline shell script after navigation cleanup');
  let source=scripts[0][1];
  const financialStart=source.indexOf(financialMarker);
  const uiStart=source.indexOf(uiMarker);
  assert.ok(financialStart>=0&&uiStart>financialStart,'financial/UI boundaries must survive cleanup');
  source=source.slice(0,financialStart)+source.slice(uiStart);
  const initStart=source.indexOf(initMarker);
  assert.ok(initStart>=0,'initialization boundary must survive cleanup');
  return source.slice(0,initStart);
}

function execute(context,source,filename='inline.js'){
  return new vm.Script(source,{filename}).runInContext(context);
}

async function bootCleanedShell(){
  const dom=new JSDOM(shell,{url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom;
  window.alert=()=>{};
  window.confirm=()=>true;
  const context=dom.getInternalVMContext();

  execute(context,effectiveShellScript(),'app-shell-cleaned-effective.js');
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

test('navigation compatibility cleanup leaves canonical production runtime bootable',async()=>{
  assert.notEqual(shell,originalShell,'fixture must exercise the post-cleanup shell');
  for(const name of ['bindNav','profileSwitcher','bindProfileSwitcher']){
    assert.doesNotMatch(shell,new RegExp(`\\bfunction\\s+${name}\\s*\\(`),`${name} legacy source still present`);
  }

  const {dom,manifest}=await bootCleanedShell();
  const document=dom.window.document;
  assert.ok(manifest.scripts.includes('./navigation-compat.js'),'canonical navigation owner missing from production manifest');
  assert.deepEqual(
    [...document.querySelectorAll('.product-nav [data-page]')].map(button=>button.dataset.page),
    ['home','income','goals','history','analytics']
  );
  assert.ok(document.querySelector('.product-avatar[data-page="settings"]'));
  dom.window.close();
});

test('canonical navigation and profile switching remain interactive after legacy helper removal',async()=>{
  const {dom,context}=await bootCleanedShell();
  const document=dom.window.document;

  for(const page of ['income','goals','history','analytics','home']){
    const button=document.querySelector(`.product-nav [data-page="${page}"]`);
    assert.ok(button,`${page} navigation button missing`);
    button.click();
    assert.equal(execute(context,'activePage',`cleaned-active-${page}.js`),page);
  }

  const before=execute(context,'state.activeProfileId','profile-before.js');
  const switcherHTML=execute(context,`
    state.profiles.push({...clone(activeProfile()),id:'profile-cleanup-smoke',name:'Second profile'});
    profileSwitcher();
  `,'build-profile-switcher.js');
  const host=document.createElement('div');
  host.innerHTML=switcherHTML;
  document.body.appendChild(host);
  execute(context,'bindProfileSwitcher()','bind-cleaned-profile-switcher.js');

  const select=document.getElementById('profileSwitch');
  assert.ok(select,'canonical profile switcher helper missing after legacy source removal');
  select.value='profile-cleanup-smoke';
  select.onchange();
  assert.notEqual(execute(context,'state.activeProfileId','profile-after.js'),before);
  assert.equal(execute(context,'state.activeProfileId','profile-selected.js'),'profile-cleanup-smoke');

  dom.window.close();
});
