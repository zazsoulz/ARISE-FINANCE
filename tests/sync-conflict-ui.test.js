const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function load(path,context){new vm.Script(fs.readFileSync(path,'utf8'),{filename:path}).runInContext(context);}

function boot({pushResult={status:'synced'},pullResult={status:'pulled'}}={}){
  const acked=[];
  const profile={
    id:'p1',name:'Основной',ariseSync:{remoteId:'rp1'},
    categories:[],transactions:[],
    goals:[{id:'g1',name:'Отпуск',ariseSync:{remoteId:'rg1',dirty:true,syncedAt:'2026-08-20T08:00:00Z',changedAt:'2026-08-20T09:00:00Z',conflict:{reason:'concurrent_remote_change',remoteUpdatedAt:'2026-08-20T10:00:00Z'}}}]
  };
  const queued=[{id:'goal:g1',entity:'goal',entityLocalId:'g1',entityRemoteId:'rg1',action:'upsert'}];
  let saved=0;let pushed=0;let pulled=0;
  const context=vm.createContext({
    console,globalThis:null,window:null,state:{profiles:[profile]},
    renderTopbar:()=>'<header class="topbar"><div>ARISE</div></header>',
    ARISE_SYNC:{pushAll:async()=>{pushed++;return pushResult;}},
    ARISE_SYNC_PULL:{pullAll:async()=>{pulled++;return pullResult;}},
    ARISE_SYNC_OUTBOX:{list:(p,entity)=>queued.filter(item=>!entity||item.entity===entity),ack:(p,id)=>{acked.push(id);const i=queued.findIndex(item=>item.id===id);if(i>=0)queued.splice(i,1);}},
    saveState:()=>{saved++;},ARISE_SYNC_SILENT:false,
    escapeHTML:value=>String(value),toast:()=>{},render:()=>{},openModal:()=>{},closeModal:()=>{},
    addEventListener:()=>{}
  });
  context.globalThis=context;context.window=context;
  load('sync-conflict-ui.js',context);
  return {context,profile,queued,acked,get saved(){return saved;},get pushed(){return pushed;},get pulled(){return pulled;}};
}

test('topbar exposes conflict resolution entry when unresolved conflicts exist',()=>{
  const env=boot();
  const conflicts=env.context.ARISE_SYNC_CONFLICT_UI.collectConflicts();
  assert.equal(conflicts.length,1);
  assert.equal(conflicts[0].entity,'goal');
  const html=env.context.renderTopbar();
  assert.match(html,/data-sync-conflicts/);
  assert.match(html,/Конфликт/);
});

test('keep local explicitly acknowledges remote baseline then pushes local version',async()=>{
  const env=boot();
  const descriptor=env.context.ARISE_SYNC_CONFLICT_UI.collectConflicts()[0];
  await env.context.ARISE_SYNC_CONFLICT_UI.keepLocal(descriptor);
  const meta=env.profile.goals[0].ariseSync;
  assert.equal(env.pushed,1);
  assert.equal(meta.dirty,true);
  assert.equal(meta.syncedAt,'2026-08-20T10:00:00Z');
  assert.equal(meta.conflict,undefined);
  assert.equal(env.queued.length,1,'local overwrite mutation must remain queued until push acknowledges it');
});

test('accept remote clears only the conflicting queued mutation after successful pull',async()=>{
  const env=boot();
  const descriptor=env.context.ARISE_SYNC_CONFLICT_UI.collectConflicts()[0];
  await env.context.ARISE_SYNC_CONFLICT_UI.acceptRemote(descriptor);
  const meta=env.profile.goals[0].ariseSync;
  assert.equal(env.pulled,1);
  assert.equal(meta.dirty,false);
  assert.equal(meta.conflict,undefined);
  assert.deepEqual(env.acked,['goal:g1']);
  assert.equal(env.queued.length,0);
  assert.equal(env.saved,1);
});

test('failed remote acceptance restores local dirty conflict and keeps mutation queued',async()=>{
  const env=boot({pullResult:{status:'offline'}});
  const descriptor=env.context.ARISE_SYNC_CONFLICT_UI.collectConflicts()[0];
  await assert.rejects(()=>env.context.ARISE_SYNC_CONFLICT_UI.acceptRemote(descriptor),/Не удалось получить серверную версию/);
  const meta=env.profile.goals[0].ariseSync;
  assert.equal(meta.dirty,true);
  assert.equal(meta.conflict.reason,'concurrent_remote_change');
  assert.equal(env.queued.length,1);
  assert.deepEqual(env.acked,[]);
});
