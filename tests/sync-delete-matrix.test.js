const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function load(path,context){new vm.Script(fs.readFileSync(path,'utf8'),{filename:path}).runInContext(context);}

function hardeningContext(){
  const queued=[];
  const context=vm.createContext({
    console,globalThis:null,window:null,state:{profiles:[]},saveState(){},
    ARISE_SYNC_PULL:{pullAll:async()=>({status:'pulled'})},
    ARISE_SYNC_OUTBOX:{list(){return queued;}}
  });
  context.globalThis=context;context.window=context;
  load('sync-conflict-policy.js',context);
  load('sync-conflict-hardening.js',context);
  return {context,queued};
}

test('clean synced entity follows a confirmed remote deletion',()=>{
  const {context}=hardeningContext();
  const profile={categories:[{id:'cat',ariseSync:{remoteId:'remote-cat',dirty:false,syncedAt:'2026-08-20T05:00:00Z'}}]};
  const result=context.ARISE_SYNC_CONFLICT_HARDENING.reconcileCollection(profile,'categories','category',new Set());
  assert.equal(profile.categories.length,0);
  assert.deepEqual({...result},{removed:1,detached:0,conflictsKept:0});
});

test('dirty local edit survives remote deletion and becomes a recreate mutation',()=>{
  const {context,queued}=hardeningContext();
  queued.push({entity:'goal',entityLocalId:'g1',entityRemoteId:'remote-g1',action:'upsert'});
  const goal={id:'g1',name:'Локальная правка',ariseSync:{remoteId:'remote-g1',dirty:true,changedAt:'2026-08-20T06:00:00Z',syncedAt:'2026-08-20T05:00:00Z'}};
  const profile={goals:[goal]};
  const result=context.ARISE_SYNC_CONFLICT_HARDENING.reconcileCollection(profile,'goals','goal',new Set());
  assert.equal(profile.goals.length,1);
  assert.equal(goal.ariseSync.remoteId,null);
  assert.equal(goal.ariseSync.dirty,true);
  assert.equal('syncedAt' in goal.ariseSync,false);
  assert.equal(queued[0].entityRemoteId,null);
  assert.deepEqual({...result},{removed:0,detached:1,conflictsKept:0});
});

test('existing stale-write conflict is never silently converted into a recreate',()=>{
  const {context}=hardeningContext();
  const conflict={reason:'concurrent_remote_change'};
  const goal={id:'g1',ariseSync:{remoteId:'remote-g1',dirty:true,conflict}};
  const profile={goals:[goal]};
  const result=context.ARISE_SYNC_CONFLICT_HARDENING.reconcileCollection(profile,'goals','goal',new Set());
  assert.equal(profile.goals.length,1);
  assert.equal(goal.ariseSync.remoteId,'remote-g1');
  assert.equal(goal.ariseSync.conflict,conflict);
  assert.deepEqual({...result},{removed:0,detached:0,conflictsKept:1});
});

test('transaction remote deletion uses the same clean versus dirty matrix',()=>{
  const {context}=hardeningContext();
  const clean={id:'clean',ariseSync:{remoteId:'r-clean',dirty:false,syncedAt:'2026-08-20T05:00:00Z'}};
  const dirty={id:'dirty',ariseSync:{remoteId:'r-dirty',dirty:true,changedAt:'2026-08-20T06:00:00Z'}};
  const profile={transactions:[clean,dirty]};
  const result=context.ARISE_SYNC_CONFLICT_HARDENING.reconcileCollection(profile,'transactions','transaction',new Set());
  assert.equal(profile.transactions.map(tx=>tx.id).join(','),'dirty');
  assert.equal(dirty.ariseSync.remoteId,null);
  assert.deepEqual({...result},{removed:1,detached:1,conflictsKept:0});
});

test('remote closed goal metadata restores canonical local lifecycle',()=>{
  const {context}=hardeningContext();
  const goal={id:'g1',status:'active',autoAllocate:true,ariseSync:{remoteId:'remote-g1',dirty:false}};
  const profile={goals:[goal]};
  context.ARISE_SYNC_CONFLICT_HARDENING.hydrateGoalClosure(profile,[{id:'remote-g1',status:'closed',closed_at:'2026-08-20T07:00:00Z',closure_balance:25000,closure_destination:'reserve'}]);
  assert.equal(goal.status,'closed');
  assert.equal(goal.autoAllocate,false);
  assert.equal(goal.closedAt,'2026-08-20T07:00:00Z');
  assert.equal(goal.closureBalance,25000);
  assert.equal(goal.closureDestination,'reserve');
});

function entityContext(){
  const calls=[];const acked=[];const failed=[];
  const builder={
    update(payload){calls.push({op:'update',payload});return this;},eq(){return this;},select(){return this;},
    async maybeSingle(){return {data:null,error:null};},
    insert(payload){calls.push({op:'insert',payload});return {select(){return this;},async single(){return {data:{id:'new-remote'},error:null};}};}
  };
  const context=vm.createContext({
    console,globalThis:null,window:null,navigator:{onLine:true},setTimeout,clearTimeout,
    ARISE_SUPABASE:{getClient:()=>({from:()=>builder}),currentSession:()=>({user:{id:'user'}})},
    ARISE_SYNC_OUTBOX:{ack:(p,id)=>acked.push(id),fail:(p,id)=>failed.push(id),list:()=>[]}
  });
  context.globalThis=context;context.window=context;
  load('sync-entity-outbox.js',context);
  return {context,calls,acked,failed};
}

test('closed goal payload persists closure state and cannot auto allocate',()=>{
  const {context}=entityContext();
  const payload=context.ARISE_ENTITY_OUTBOX.goalPayload({settings:{currency:'RUB'}},'profile','user',{
    name:'Отпуск',target:100000,ledgerStart:25000,status:'closed',autoAllocate:true,
    closedAt:'2026-08-20T07:00:00Z',closureBalance:25000,closureDestination:'reserve'
  });
  assert.equal(payload.status,'closed');
  assert.equal(payload.auto_allocate,false);
  assert.equal(payload.closed_at,'2026-08-20T07:00:00Z');
  assert.equal(payload.closure_balance,25000);
  assert.equal(payload.closure_destination,'reserve');
});

test('vanished remote entity falls back from update to insert without losing dirty local data',async()=>{
  const {context,calls,acked,failed}=entityContext();
  const goal={id:'g1',name:'Сохранить',target:50000,ledgerStart:0,status:'active',ariseSync:{remoteId:'gone',dirty:true}};
  const profile={settings:{currency:'RUB'},goals:[goal],categories:[]};
  await context.ARISE_ENTITY_OUTBOX.processMutation(profile,'profile','user',{id:'goal:g1',entity:'goal',entityLocalId:'g1',entityRemoteId:'gone',action:'upsert'});
  assert.deepEqual(calls.map(call=>call.op),['update','insert']);
  assert.equal(goal.ariseSync.remoteId,'new-remote');
  assert.equal(goal.ariseSync.dirty,false);
  assert.deepEqual(acked,['goal:g1']);
  assert.deepEqual(failed,[]);
});
