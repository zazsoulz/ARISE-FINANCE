const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

const source=fs.readFileSync('product-ui.js','utf8');

function boot(){
  const dom=new JSDOM('<!doctype html><button class="product-sync"><span></span></button>',{
    url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true
  });
  const ctx=dom.getInternalVMContext();
  dom.window.state={account:{}};
  dom.window.activePage='home';
  dom.window.activeMonth='2026-08';
  dom.window.activeProfile=()=>({name:'QA'});
  dom.window.formatMonth=()=> 'август 2026';
  dom.window.escapeHTML=value=>String(value);
  dom.window.renderHome=()=>{};
  dom.window.renderHistory=()=>{};
  dom.window.showIncomeModal=()=>{};
  dom.window.showExpenseModal=()=>{};
  dom.window.toast=message=>{dom.window.__toast=message;};
  new vm.Script(source,{filename:'product-ui.js'}).runInContext(ctx);
  return {dom,ctx,ui:dom.window.ARISE_PRODUCT_UI};
}

function setOnline(window,value){
  Object.defineProperty(window.navigator,'onLine',{configurable:true,value});
}

test('global sync state distinguishes offline, local-only, conflict, error, busy and synced',()=>{
  const {dom,ui}=boot();
  setOnline(dom.window,false);
  assert.equal(ui.syncState().kind,'offline');

  setOnline(dom.window,true);
  const states=[
    ['signed_out','local'],
    ['conflict','conflict'],
    ['error','error'],
    ['busy','syncing'],
    ['synced','online']
  ];
  for(const [status,kind] of states){
    dom.window.ARISE_SYNC={lastResult:()=>({status})};
    assert.equal(ui.syncState().kind,kind,status);
  }
  dom.window.close();
});

test('offline retry never attempts a server write and explains local preservation',async()=>{
  const {dom,ui}=boot();
  setOnline(dom.window,false);
  let pushes=0;
  dom.window.ARISE_SYNC={lastResult:()=>({status:'error'}),pushAll:async()=>{pushes++;}};
  assert.equal(await ui.retrySync(),false);
  assert.equal(pushes,0);
  assert.match(dom.window.__toast,/сохранены на устройстве/i);
  dom.window.close();
});

test('conflict action routes to explicit resolver instead of retrying stale writes',async()=>{
  const {dom,ui}=boot();
  setOnline(dom.window,true);
  let pushes=0;
  let opened=0;
  dom.window.ARISE_SYNC={lastResult:()=>({status:'conflict'}),pushAll:async()=>{pushes++;}};
  dom.window.ARISE_SYNC_CONFLICT_UI={showConflicts:()=>{opened++;}};
  assert.equal(await ui.retrySync(),false);
  assert.equal(opened,1);
  assert.equal(pushes,0);
  dom.window.close();
});

test('retry failure preserves recoverable state and exposes retry copy',async()=>{
  const {dom,ui}=boot();
  setOnline(dom.window,true);
  dom.window.ARISE_SYNC={
    lastResult:()=>({status:'error'}),
    pushAll:async()=>{throw new Error('network');}
  };
  assert.equal(await ui.retrySync(),false);
  assert.match(dom.window.__toast,/локальные изменения сохранены/i);
  dom.window.close();
});
