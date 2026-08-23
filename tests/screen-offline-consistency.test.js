const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

const source=fs.readFileSync('product-ui.js','utf8');

function boot(page){
  const dom=new JSDOM('<!doctype html><div id="root"></div><button class="product-sync"><span></span></button>',{
    url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true
  });
  const {window}=dom;
  Object.defineProperty(window.navigator,'onLine',{configurable:true,value:false});
  window.state={account:{name:'QA'}};
  window.activePage=page;
  window.activeMonth='2026-08';
  window.activeProfile=()=>({name:'QA profile'});
  window.formatMonth=()=> 'август 2026';
  window.escapeHTML=value=>String(value);
  window.renderHome=()=>{};
  window.renderHistory=()=>{};
  window.showIncomeModal=()=>{};
  window.showExpenseModal=()=>{};
  window.toast=message=>{window.__toast=message;};
  let pushes=0;
  window.ARISE_SYNC={
    lastResult:()=>({status:'error'}),
    pushAll:async()=>{pushes++;}
  };
  new vm.Script(source,{filename:'product-ui.js'}).runInContext(dom.getInternalVMContext());
  return {dom,ui:window.ARISE_PRODUCT_UI,getPushes:()=>pushes};
}

for(const page of ['home','income','goals','history','analytics','settings']){
  test(`${page} exposes the same safe offline recovery contract`,async()=>{
    const {dom,ui,getPushes}=boot(page);
    const state=ui.syncState();
    assert.deepEqual({...state},{kind:'offline',label:'Офлайн',action:'Проверить сеть'});

    const topbar=dom.window.renderTopbar();
    assert.match(topbar,/product-sync offline/);
    assert.match(topbar,/Офлайн/);
    assert.match(topbar,/Проверить сеть/);

    assert.equal(await ui.retrySync(),false);
    assert.equal(getPushes(),0,'offline recovery must never write remotely');
    assert.match(dom.window.__toast,/изменения сохранены на устройстве/i);
    dom.window.close();
  });
}

test('busy state remains non-actionable on every screen',()=>{
  const {dom,ui}=boot('analytics');
  Object.defineProperty(dom.window.navigator,'onLine',{configurable:true,value:true});
  dom.window.ARISE_SYNC={lastResult:()=>({status:'busy'})};
  const state=ui.syncState();
  assert.equal(state.kind,'syncing');
  const topbar=dom.window.renderTopbar();
  assert.match(topbar,/product-sync syncing/);
  assert.match(topbar,/disabled/);
  dom.window.close();
});
