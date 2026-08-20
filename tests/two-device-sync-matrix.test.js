const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function bootBase(){
  const context={console,setTimeout,clearTimeout,state:{profiles:[]},saveState(){},render(){},toast(){}};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('sync-outbox.js','utf8'),context);
  vm.runInContext(fs.readFileSync('sync-conflict-policy.js','utf8'),context);
  return context;
}

function entity({id='category-1',name='Семья',remoteId='remote-category-1',syncedAt='2026-08-20T10:00:00.000Z',dirty=false,changedAt=null}={}){
  return {id,name,ariseSync:{remoteId,syncedAt,dirty,...(changedAt?{changedAt}:{})}};
}

test('device A offline edit stays in persistent outbox until remote acknowledgement',()=>{
  const ctx=bootBase();
  const before={categories:[entity()],goals:[],transactions:[],ariseSync:{}};
  const after=JSON.parse(JSON.stringify(before));
  after.categories[0].name='Семья и близкие';
  const count=ctx.ARISE_SYNC_OUTBOX.recordCategoryChanges(before,after);
  assert.equal(count,1);
  const queued=ctx.ARISE_SYNC_OUTBOX.list(after,'category');
  assert.equal(queued.length,1);
  assert.equal(queued[0].action,'upsert');
  assert.equal(queued[0].entityRemoteId,'remote-category-1');
  assert.equal(after.ariseSync.dirty,true);
});

test('concurrent edit on device B after device A baseline becomes explicit conflict',()=>{
  const ctx=bootBase();
  const local=entity({dirty:true,changedAt:'2026-08-20T10:05:00.000Z'});
  const decision=ctx.ARISE_SYNC_CONFLICTS.resolve({
    localMeta:local.ariseSync,
    remoteUpdatedAt:'2026-08-20T10:10:00.000Z'
  });
  assert.equal(decision.winner,'conflict');
  assert.equal(decision.reason,'concurrent_remote_change');
  assert.equal(local.ariseSync.conflict.remoteUpdatedAt,'2026-08-20T10:10:00.000Z');
});

test('delete-vs-edit matrix never silently loses dirty data or resurrects clean deleted data',()=>{
  const ctx=bootBase();
  const dirty=ctx.ARISE_SYNC_CONFLICTS.resolveAbsence({localMeta:entity({dirty:true}).ariseSync});
  const clean=ctx.ARISE_SYNC_CONFLICTS.resolveAbsence({localMeta:entity({dirty:false}).ariseSync});
  assert.equal(dirty.winner,'local');
  assert.equal(dirty.reason,'local_dirty_remote_deleted');
  assert.equal(clean.winner,'remote_delete');
  assert.equal(clean.reason,'remote_deleted_clean_local');
});

test('ambiguous retry keeps a single mutation identity instead of duplicating intent',()=>{
  const ctx=bootBase();
  const profile={ariseSync:{}};
  const first=ctx.ARISE_SYNC_OUTBOX.enqueue(profile,{entity:'transaction',entityLocalId:'tx-1',entityRemoteId:null,action:'upsert'});
  ctx.ARISE_SYNC_OUTBOX.fail(profile,first.id,new Error('network timeout after remote commit'));
  const retry=ctx.ARISE_SYNC_OUTBOX.enqueue(profile,{entity:'transaction',entityLocalId:'tx-1',entityRemoteId:null,action:'upsert'});
  assert.equal(first.id,retry.id);
  assert.equal(ctx.ARISE_SYNC_OUTBOX.list(profile,'transaction').length,1);
  ctx.ARISE_SYNC_OUTBOX.ack(profile,retry.id);
  assert.equal(ctx.ARISE_SYNC_OUTBOX.list(profile,'transaction').length,0);
});

function bootConflictUi(){
  const ctx=bootBase();
  const category=entity({dirty:true,changedAt:'2026-08-20T10:05:00.000Z'});
  category.ariseSync.conflict={reason:'concurrent_remote_change',baseSyncedAt:'2026-08-20T10:00:00.000Z',localChangedAt:'2026-08-20T10:05:00.000Z',remoteUpdatedAt:'2026-08-20T10:10:00.000Z'};
  const profile={id:'profile-1',name:'Основной',categories:[category],goals:[],transactions:[],ariseSync:{remoteId:'remote-profile-1'}};
  ctx.state={profiles:[profile]};
  ctx.ARISE_SYNC_OUTBOX.enqueue(profile,{entity:'category',entityLocalId:category.id,entityRemoteId:category.ariseSync.remoteId,action:'upsert'});
  ctx.ARISE_SYNC={pushAll:async()=>({status:'synced'})};
  ctx.ARISE_SYNC_PULL={pullAll:async()=>({status:'pulled'})};
  vm.runInContext(fs.readFileSync('sync-conflict-ui.js','utf8'),ctx);
  return {ctx,profile,category};
}

test('explicit keep-local resolution advances baseline and preserves queued local intent',async()=>{
  const {ctx,profile,category}=bootConflictUi();
  const descriptor=ctx.ARISE_SYNC_CONFLICT_UI.collectConflicts()[0];
  const result=await ctx.ARISE_SYNC_CONFLICT_UI.keepLocal(descriptor);
  assert.equal(result.status,'synced');
  assert.equal(category.ariseSync.conflict,undefined);
  assert.equal(category.ariseSync.dirty,true);
  assert.equal(category.ariseSync.syncedAt,'2026-08-20T10:10:00.000Z');
  assert.equal(ctx.ARISE_SYNC_OUTBOX.list(profile,'category').length,1);
});

test('explicit accept-remote resolution clears only the conflicting queued mutation after successful pull',async()=>{
  const {ctx,profile,category}=bootConflictUi();
  const descriptor=ctx.ARISE_SYNC_CONFLICT_UI.collectConflicts()[0];
  const result=await ctx.ARISE_SYNC_CONFLICT_UI.acceptRemote(descriptor);
  assert.equal(result.status,'pulled');
  assert.equal(category.ariseSync.conflict,undefined);
  assert.equal(category.ariseSync.dirty,false);
  assert.equal(ctx.ARISE_SYNC_OUTBOX.list(profile,'category').length,0);
});
