const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function deferred(){
  let resolve;
  const promise=new Promise(done=>{resolve=done;});
  return {promise,resolve};
}

function boot(){
  const gate=deferred();
  const events=[];
  const listeners={};
  const context={
    console,
    navigator:{onLine:true},
    state:{profiles:[],account:{}},
    saveState:()=>{},
    ARISE_SUPABASE:{
      getClient:()=>({}),
      currentSession:()=>({user:{id:'user-1'}}),
      listFinanceProfiles:()=>gate.promise
    },
    CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}},
    dispatchEvent:event=>{events.push(event);for(const handler of listeners[event.type]||[])handler(event);return true;},
    addEventListener:(type,handler)=>{(listeners[type]||=([])).push(handler);},
    clearTimeout,
    setTimeout
  };
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('sync-engine.js','utf8'),context,{filename:'sync-engine.js'});
  return {context,gate,events};
}

test('sync publishes busy before remote work completes and then publishes synced',async()=>{
  const {context,gate,events}=boot();
  const pending=context.ARISE_SYNC.pushAll();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(context.ARISE_SYNC.lastResult().status,'busy');
  assert.equal(events.length,1);
  assert.equal(events[0].type,'arise:sync');
  assert.equal(events[0].detail.status,'busy');

  const concurrent=await context.ARISE_SYNC.pushAll();
  assert.equal(concurrent.status,'busy');

  gate.resolve([]);
  const result=await pending;
  assert.equal(result.status,'synced');
  assert.equal(context.ARISE_SYNC.lastResult().status,'synced');
  assert.deepEqual(events.map(event=>event.detail.status),['busy','synced']);
});
