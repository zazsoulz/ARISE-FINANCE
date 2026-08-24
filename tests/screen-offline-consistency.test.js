const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

const source=fs.readFileSync('product-ui.js','utf8');
const pages=['home','income','goals','history','analytics','settings'];

function boot(page,{online=true,status='synced',push='success'}={}){
  const dom=new JSDOM('<!doctype html><div id="root"></div><button class="product-sync"><span></span></button>',{
    url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true
  });
  const {window}=dom;
  Object.defineProperty(window.navigator,'onLine',{configurable:true,value:online});
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
  let conflicts=0;
  window.ARISE_SYNC={
    lastResult:()=>({status}),
    pushAll:async()=>{
      pushes++;
      if(push==='failure')throw new Error('sync failed');
      return true;
    }
  };
  window.ARISE_SYNC_CONFLICT_UI={showConflicts:()=>{conflicts++;}};
  new vm.Script(source,{filename:'product-ui.js'}).runInContext(dom.getInternalVMContext());
  return {
    dom,
    ui:window.ARISE_PRODUCT_UI,
    getPushes:()=>pushes,
    getConflicts:()=>conflicts,
    setStatus(next){status=next;},
    setOnline(next){Object.defineProperty(window.navigator,'onLine',{configurable:true,value:next});}
  };
}

function assertTopbar(dom,{kind,label,action,disabled=false}){
  const topbar=dom.window.renderTopbar();
  assert.match(topbar,new RegExp(`product-sync ${kind}`));
  assert.match(topbar,new RegExp(label));
  assert.match(topbar,new RegExp(action));
  if(disabled)assert.match(topbar,/disabled/);
}

for(const page of pages){
  test(`${page} exposes the same safe offline recovery contract`,async()=>{
    const {dom,ui,getPushes}=boot(page,{online:false,status:'error'});
    assert.deepEqual({...ui.syncState()},{kind:'offline',label:'Офлайн',action:'Проверить сеть'});
    assertTopbar(dom,{kind:'offline',label:'Офлайн',action:'Проверить сеть'});
    assert.equal(await ui.retrySync(),false);
    assert.equal(getPushes(),0,'offline recovery must never write remotely');
    assert.match(dom.window.__toast,/изменения сохранены на устройстве/i);
    dom.window.close();
  });

  test(`${page} keeps signed-out data local and does not attempt remote writes`,async()=>{
    const {dom,ui,getPushes}=boot(page,{online:true,status:'signed_out'});
    assert.deepEqual({...ui.syncState()},{kind:'local',label:'Только на устройстве',action:'Войдите, чтобы синхронизировать'});
    assertTopbar(dom,{kind:'local',label:'Только на устройстве',action:'Войдите, чтобы синхронизировать'});
    assert.equal(await ui.retrySync(),false);
    assert.equal(getPushes(),0);
    assert.match(dom.window.__toast,/в аккаунт/i);
    dom.window.close();
  });

  test(`${page} routes conflicts to explicit resolution instead of retrying stale writes`,async()=>{
    const {dom,ui,getPushes,getConflicts}=boot(page,{online:true,status:'conflict'});
    assert.deepEqual({...ui.syncState()},{kind:'conflict',label:'Нужен выбор',action:'Открыть конфликты'});
    assertTopbar(dom,{kind:'conflict',label:'Нужен выбор',action:'Открыть конфликты'});
    assert.equal(await ui.retrySync(),false);
    assert.equal(getPushes(),0,'conflicts must never retry a stale write automatically');
    assert.equal(getConflicts(),1,'conflict resolver should open exactly once');
    dom.window.close();
  });

  test(`${page} keeps failed retry recoverable and confirms local preservation`,async()=>{
    const {dom,ui,getPushes}=boot(page,{online:true,status:'error',push:'failure'});
    assert.deepEqual({...ui.syncState()},{kind:'error',label:'Ошибка синхронизации',action:'Повторить синхронизацию'});
    assertTopbar(dom,{kind:'error',label:'Ошибка синхронизации',action:'Повторить синхронизацию'});
    assert.equal(await ui.retrySync(),false);
    assert.equal(getPushes(),1,'error recovery should perform one explicit retry');
    assert.match(dom.window.__toast,/локальные изменения сохранены/i);
    dom.window.close();
  });

  test(`${page} exposes syncing and synced states consistently`,async()=>{
    const busy=boot(page,{online:true,status:'busy'});
    assert.deepEqual({...busy.ui.syncState()},{kind:'syncing',label:'Синхронизация',action:'Синхронизация выполняется'});
    assertTopbar(busy.dom,{kind:'syncing',label:'Синхронизация',action:'Синхронизация выполняется',disabled:true});
    assert.equal(await busy.ui.retrySync(),false);
    assert.equal(busy.getPushes(),0);
    busy.dom.window.close();

    const synced=boot(page,{online:true,status:'synced'});
    assert.deepEqual({...synced.ui.syncState()},{kind:'online',label:'Синхронизировано',action:'Синхронизировать сейчас'});
    assertTopbar(synced.dom,{kind:'online',label:'Синхронизировано',action:'Синхронизировать сейчас'});
    assert.equal(await synced.ui.retrySync(),true);
    assert.equal(synced.getPushes(),1);
    synced.dom.window.close();
  });
}
