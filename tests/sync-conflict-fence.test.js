const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function load(path,context){
  new vm.Script(fs.readFileSync(path,'utf8'),{filename:path}).runInContext(context);
}

function contextBase(){
  const context=vm.createContext({
    console,
    globalThis:null,
    window:null,
    navigator:{onLine:true},
    setTimeout,
    clearTimeout,
    addEventListener:()=>{}
  });
  context.globalThis=context;
  context.window=context;
  return context;
}

const conflict={
  reason:'concurrent_remote_change',
  baseSyncedAt:'2026-08-20T09:00:00.000Z',
  localChangedAt:'2026-08-20T10:00:00.000Z',
  remoteUpdatedAt:'2026-08-20T11:00:00.000Z'
};

test('category outbox keeps a concurrent edit queued and performs no server write',async()=>{
  const ctx=contextBase();
  let writes=0;
  let acked=0;
  let failed=0;
  ctx.ARISE_SUPABASE={
    getClient:()=>({from:()=>{writes++;throw new Error('server write must be fenced');}}),
    currentSession:()=>({user:{id:'user-1'}})
  };
  ctx.ARISE_SYNC_OUTBOX={
    ack:()=>{acked++;},
    fail:()=>{failed++;}
  };
  load('sync-entity-outbox.js',ctx);

  const category={
    id:'cat-local',name:'Жизнь',type:'percentage',percent:20,priority:3,enabled:true,
    ariseSync:{remoteId:'cat-remote',dirty:true,syncedAt:'2026-08-20T09:00:00.000Z',conflict:{...conflict}}
  };
  const profile={categories:[category],goals:[],settings:{currency:'RUB'}};
  const mutation={id:'m1',entity:'category',entityLocalId:'cat-local',entityRemoteId:'cat-remote',action:'upsert'};

  await assert.rejects(
    ()=>ctx.ARISE_ENTITY_OUTBOX.processMutation(profile,'profile-remote','user-1',mutation),
    error=>error&&error.code==='ARISE_SYNC_CONFLICT'
  );
  assert.equal(writes,0);
  assert.equal(acked,0);
  assert.equal(failed,1);
  assert.equal(category.ariseSync.dirty,true);
  assert.equal(category.ariseSync.conflict.reason,'concurrent_remote_change');
});

test('transaction outbox keeps a concurrent edit queued and performs no server write',async()=>{
  const ctx=contextBase();
  let writes=0;
  let acked=0;
  let failed=0;
  ctx.ARISE_SUPABASE={
    getClient:()=>({from:()=>{writes++;throw new Error('server write must be fenced');}}),
    currentSession:()=>({user:{id:'user-1'}})
  };
  ctx.ARISE_SYNC_OUTBOX={
    list:()=>[{id:'m1',entity:'transaction',entityLocalId:'tx-local',entityRemoteId:'tx-remote',action:'upsert'}],
    ack:()=>{acked++;},
    fail:()=>{failed++;}
  };
  load('sync-engine.js',ctx);

  const tx={
    id:'tx-local',type:'expense',amount:1000,date:'2026-08-20',currency:'RUB',
    ariseSync:{remoteId:'tx-remote',dirty:true,syncedAt:'2026-08-20T09:00:00.000Z',conflict:{...conflict}}
  };
  const profile={transactions:[tx],categories:[],goals:[],settings:{currency:'RUB'}};

  await assert.rejects(
    ()=>ctx.ARISE_SYNC.flushTransactionOutbox(profile,'profile-remote',{id:'user-1'}),
    error=>error&&error.code==='ARISE_SYNC_CONFLICT'
  );
  assert.equal(writes,0);
  assert.equal(acked,0);
  assert.equal(failed,1);
  assert.equal(tx.ariseSync.dirty,true);
  assert.equal(tx.ariseSync.conflict.reason,'concurrent_remote_change');
});
