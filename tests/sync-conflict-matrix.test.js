const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function load(path,context){
  new vm.Script(fs.readFileSync(path,'utf8'),{filename:path}).runInContext(context);
}

function hardeningContext(){
  const queued=[];
  const context=vm.createContext({
    console,
    globalThis:null,
    window:null,
    state:{profiles:[]},
    saveState(){},
    ARISE_SYNC_PULL:{pullAll:async()=>({status:'pulled'})},
    ARISE_SYNC_OUTBOX:{list(){return queued;}}
  });
  context.globalThis=context;
  context.window=context;
  load('sync-conflict-policy.js',context);
  load('sync-conflict-hardening.js',context);
  return {context,queued};
}

test('remote delete removes a clean synced category instead of resurrecting it',()=>{
  const {context}=hardeningContext();
  const profile={categories:[{id:'local-cat',name:'Жизнь',ariseSync:{remoteId:'remote-cat',dirty:false,syncedAt:'2026-08-20T05:00:00Z'}}]};
  const result=context.ARISE_SYNC_CONFLICT_HARDENING.reconcileCollection(profile,'categories','category',new Set());
  assert.equal(profile.categories.length,0);
  assert.deepEqual({...result},{removed:1,detached:0});
});

test('remote delete keeps a dirty local edit and detaches the deleted remote id for recreation',()=>{
  const {context,queued}=hardeningContext();
  queued.push({entity:'category',entityLocalId:'local-cat',entityRemoteId:'remote-cat',action:'upsert'});
  const category={id:'local-cat',name:'Моя правка',ariseSync:{remoteId:'remote-cat',dirty:true,changedAt:'2026-08-20T06:00:00Z',syncedAt:'2026-08-20T05:00:00Z'}};
  const profile={categories:[category]};
  const result=context.ARISE_SYNC_CONFLICT_HARDENING.reconcileCollection(profile,'categories','category',new Set());
  assert.equal(profile.categories.length,1);
  assert.equal(category.ariseSync.remoteId,null);
  assert.equal(category.ariseSync.dirty,true);
  assert.equal('syncedAt' in category.ariseSync,false);
  assert.equal(queued[0].entityRemoteId,null);
  assert.deepEqual({...result},{removed:0,detached:1});
});

test('remote delete follows the same matrix for synced transactions',()=>{
  const {context}=hardeningContext();
  const clean={id:'clean',ariseSync:{remoteId:'r-clean',dirty:false,syncedAt:'2026-08-20T05:00:00Z'}};
  const dirty={id:'dirty',ariseSync:{remoteId:'r-dirty',dirty:true,changedAt:'2026-08-20T06:00:00Z'}};
  const profile={transactions:[clean,dirty]};
  const result=context.ARISE_SYNC_CONFLICT_HARDENING.reconcileCollection(profile,'transactions','transaction',new Set());
  assert.deepEqual(profile.transactions.map(tx=>tx.id),['dirty']);
  assert.equal(dirty.ariseSync.remoteId,null);
  assert.deepEqual({...result},{removed:1,detached:1});
});

test('remote closed goal lifecycle metadata is restored locally',()=>{
  const {context}=hardeningContext();
  const goal={id:'g1',status:'active',autoAllocate:true,ariseSync:{remoteId:'remote-goal',dirty:false}};
  const profile={goals:[goal]};
  context.ARISE_SYNC_CONFLICT_HARDENING.hydrateGoalClosure(profile,[{
    id:'remote-goal',status:'closed',closed_at:'2026-08-20T07:00:00Z',closure_balance:25000,closure_destination:'reserve'
  }]);
  assert.equal(goal.status,'closed');
  assert.equal(goal.autoAllocate,false);
  assert.equal(goal.closedAt,'2026-08-20T07:00:00Z');
  assert.equal(goal.closureBalance,25000);
  assert.equal(goal.closureDestination,'reserve');
});

function entityOutboxContext(){
  const calls=[];
  const acked=[];
  const builder={
    update(payload){calls.push({op:'update',payload});return this;},
    eq(){return this;},
    select(){return this;},
    async maybeSingle(){return {data:null,error:null};},
    insert(payload){calls.push({op:'insert',payload});return {
      select(){return this;},
      async single(){return {data:{id:'new-remote-id'},error:null};}
    };}
  };
  const client={from(){return builder;}};
  const outbox={
    ack(profile,id){acked.push(id);return true;},
    fail(){},
    list(){return [];}
  };
  const context=vm.createContext({
    console,
    globalThis:null,
    window:null,
    navigator:{onLine:true},
    setTimeout,
    clearTimeout,
    ARISE_SUPABASE:{getClient:()=>client,currentSession:()=>({user:{id:'user-1'}})},
    ARISE_SYNC_OUTBOX:outbox
  });
  context.globalThis=context;
  context.window=context;
  load('sync-entity-outbox.js',context);
  return {context,calls,acked};
}

test('closed goal payload survives sync with closure metadata',()=>{
  const {context}=entityOutboxContext();
  const payload=context.ARISE_ENTITY_OUTBOX.goalPayload(
    {settings:{currency:'RUB'}},'profile-1','user-1',
    {name:'Отпуск',target:100000,ledgerStart:25000,status:'closed',autoAllocate:false,closedAt:'2026-08-20T07:00:00Z',closureBalance:25000,closureDestination:'reserve'}
  );
  assert.equal(payload.status,'closed');
  assert.equal(payload.auto_allocate,false);
  assert.equal(payload.closed_at,'2026-08-20T07:00:00Z');
  assert.equal(payload.closure_balance,25000);
  assert.equal(payload.closure_destination,'reserve');
});

test('dirty entity whose remote row vanished falls back from update to insert',async()=>{
  const {context,calls,acked}=entityOutboxContext();
  const goal={id:'local-goal',name:'Сохранить меня',target:50000,ledgerStart:0,status:'active',ariseSync:{remoteId:'deleted-remote-id',dirty:true}};
  const profile={settings:{currency:'RUB'},goals:[goal],categories:[]};
  const mutation={id:'goal:local-goal',entity:'goal',entityLocalId:'local-goal',entityRemoteId:'deleted-remote-id',action:'upsert'};
  await context.ARISE_ENTITY_OUTBOX.processMutation(profile,'profile-1','user-1',mutation);
  assert.deepEqual(calls.map(call=>call.op),['update','insert']);
  assert.equal(goal.ariseSync.remoteId,'new-remote-id');
  assert.equal(goal.ariseSync.dirty,false);
  assert.deepEqual(acked,['goal:local-goal']);
});
