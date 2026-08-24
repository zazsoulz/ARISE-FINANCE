const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

const source=fs.readFileSync('navigation-compat.js','utf8');
const loader=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');

test('navigation compatibility helpers load before canonical renderers',()=>{
  const compat=loader.indexOf('./navigation-compat.js');
  const arise=loader.indexOf('./arise-v3.js');
  const settings=loader.indexOf('./settings-ui.js');
  const bootstrap=loader.indexOf('./financial-bootstrap.js');
  assert.ok(compat>=0&&arise>compat&&settings>arise&&bootstrap>settings);
  for(const name of ['bindNav','profileSwitcher','bindProfileSwitcher']){
    assert.match(source,new RegExp(`root\\.${name}=${name}`),`${name} export missing`);
  }
});

test('profile switcher renders and switches financial profiles independently of retired nav source',()=>{
  const dom=new JSDOM('<!doctype html><div id="host"></div>');
  const state={activeProfileId:'p1',profiles:[{id:'p1',name:'Основной'},{id:'p2',name:'Второй'}]};
  let switched='';
  const context={console,document:dom.window.document,state,activeProfile:()=>state.profiles.find(p=>p.id===state.activeProfileId),escapeHTML:value=>String(value),switchProfile:id=>{switched=id;},activePage:'home',render:()=>{}};
  context.window=context;context.globalThis=context;vm.createContext(context);
  vm.runInContext(source,context,{filename:'navigation-compat.js'});
  const html=context.profileSwitcher();
  dom.window.document.getElementById('host').innerHTML=html;
  const select=dom.window.document.getElementById('profileSwitch');
  assert.ok(select);
  assert.equal(select.value,'p1');
  context.bindProfileSwitcher();
  select.value='p2';select.onchange();
  assert.equal(switched,'p2');
});

test('physical nav retirement preserves shared helpers through external compatibility ownership',()=>{
  assert.doesNotMatch(shell,/\bconst\s+NAV_ITEMS\s*=/);
  assert.doesNotMatch(shell,/function\s+renderNav\s*\(/);
  for(const name of ['bindNav','profileSwitcher','bindProfileSwitcher']){
    assert.doesNotMatch(shell,new RegExp(`\\bfunction\\s+${name}\\s*\\(`),`${name} legacy copy must stay physically retired`);
  }
  assert.match(source,/ARISE_NAVIGATION_COMPAT/);
  for(const name of ['bindNav','profileSwitcher','bindProfileSwitcher']){
    assert.match(source,new RegExp(`root\\.${name}=${name}`));
  }
});
