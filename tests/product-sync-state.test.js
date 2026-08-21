const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('product-ui.js','utf8');

function boot({online=true,lastResult=null,pushAll=null,showConflicts=null}={}){
  const listeners={};
  const context={
    console,
    navigator:{onLine:online},
    addEventListener:(name,fn)=>{listeners[name]=fn;},
    ARISE_SYNC:{
      lastResult:()=>lastResult,
      pushAll:pushAll||async()=>({status:'synced'})
    }
  };
  if(showConflicts)context.ARISE_SYNC_CONFLICT_UI={showConflicts};
  context.globalThis=context;
  vm.createContext(context);
  new vm.Script(source,{filename:'product-ui.js'}).runInContext(context);
  return {context,listeners};
}

test('sync state distinguishes offline, conflict, error, signed-out and busy states',()=>{
  assert.equal(boot({online:false}).context.ARISE_PRODUCT_UI.syncState().kind,'offline');
  assert.equal(boot({lastResult:{status:'conflict'}}).context.ARISE_PRODUCT_UI.syncState().kind,'conflict');
  assert.equal(boot({lastResult:{status:'error'}}).context.ARISE_PRODUCT_UI.syncState().kind,'error');
  assert.equal(boot({lastResult:{status:'signed_out'}}).context.ARISE_PRODUCT_UI.syncState().kind,'local');
  assert.equal(boot({lastResult:{status:'busy'}}).context.ARISE_PRODUCT_UI.syncState().kind,'syncing');
});

test('retry sync does not attempt remote writes while offline',async()=>{
  let calls=0;
  const {context}=boot({online:false,pushAll:async()=>{calls++;}});
  assert.equal(await context.ARISE_PRODUCT_UI.retrySync(),false);
  assert.equal(calls,0);
});

test('retry sync calls canonical pushAll when online',async()=>{
  let calls=0;
  const {context}=boot({online:true,lastResult:{status:'error'},pushAll:async()=>{calls++;return {status:'synced'};}});
  assert.equal(await context.ARISE_PRODUCT_UI.retrySync(),true);
  assert.equal(calls,1);
});

test('conflict state opens the canonical conflict resolver instead of retrying stale writes',async()=>{
  let pushes=0;
  let opens=0;
  const {context}=boot({
    lastResult:{status:'conflict'},
    pushAll:async()=>{pushes++;},
    showConflicts:()=>{opens++;}
  });
  assert.equal(await context.ARISE_PRODUCT_UI.retrySync(),false);
  assert.equal(opens,1);
  assert.equal(pushes,0);
});

test('global delegated click handler wires every rendered sync control',()=>{
  let prevented=0;
  const {listeners}=boot();
  assert.equal(typeof listeners.click,'function');
  const button={};
  listeners.click({
    target:{closest:selector=>selector==='.product-sync'?button:null},
    preventDefault:()=>{prevented++;}
  });
  assert.equal(prevented,1);
});

test('topbar sync control is a real accessible button with retry semantics',()=>{
  assert.match(source,/button type=\"button\" class=\"product-sync/);
  assert.match(source,/aria-label=/);
  assert.match(source,/aria-live/);
  assert.match(source,/Повторить синхронизацию/);
  assert.match(source,/Локальные изменения сохранены/);
  assert.match(source,/showConflicts/);
});
