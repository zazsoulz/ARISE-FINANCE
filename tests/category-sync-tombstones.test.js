const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function storage(){
  const map=new Map();
  return {
    getItem:key=>map.has(String(key))?map.get(String(key)):null,
    setItem:(key,value)=>map.set(String(key),String(value)),
    removeItem:key=>map.delete(String(key))
  };
}

function bootLocalStore(){
  const localStorage=storage();
  const category={id:'local-category',name:'Семья',ariseSync:{remoteId:'11111111-1111-4111-8111-111111111111',dirty:false}};
  const goal={id:'local-goal',name:'Отпуск',target:100000,current:0,ariseSync:{remoteId:'55555555-5555-4555-8555-555555555555',dirty:false}};
  const profile={id:'local-profile',name:'Основной',categories:[category],goals:[goal],transactions:[],settings:{currency:'RUB'},ariseSync:{remoteId:'22222222-2222-4222-8222-222222222222',dirty:false}};
  const initial={version:1,account:{registered:true},profiles:[profile],activeProfileId:profile.id};
  const context={console,localStorage,STORAGE_KEY:'arise.finance.production.v1',state:JSON.parse(JSON.stringify(initial)),clone:value=>JSON.parse(JSON.stringify(value)),normalizeState:value=>value,defaultState:()=>({version:1,account:{registered:false},profiles:[],activeProfileId:null})};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('sync-outbox.js','utf8'),context);
  vm.runInContext(fs.readFileSync('local-account-store.js','utf8'),context);
  context.ARISE_LOCAL_ACCOUNTS.activate('user-a');
  return {context,localStorage};
}

test('deleting a synced category records a persistent outbox delete mutation instead of a new tombstone',()=>{
  const {context,localStorage}=bootLocalStore();
  context.state.profiles[0].categories=[];
  context.saveState();
  const profile=context.state.profiles[0];
  const mutation=context.ARISE_SYNC_OUTBOX.list(profile,'category')[0];
  assert.equal(mutation.action,'delete');
  assert.equal(mutation.entityRemoteId,'11111111-1111-4111-8111-111111111111');
  assert.equal(profile.ariseSync.deletedCategoryIds,undefined);
  const persisted=JSON.parse(localStorage.getItem('arise.finance.production.v1.account.user-a'));
  assert.equal(persisted.profiles[0].ariseSync.outbox[0].entity,'category');
});

test('deleting a synced goal records a persistent outbox delete mutation instead of a new tombstone',()=>{
  const {context,localStorage}=bootLocalStore();
  context.state.profiles[0].goals=[];
  context.saveState();
  const profile=context.state.profiles[0];
  const mutation=context.ARISE_SYNC_OUTBOX.list(profile,'goal')[0];
  assert.equal(mutation.action,'delete');
  assert.equal(mutation.entityRemoteId,'55555555-5555-4555-8555-555555555555');
  assert.equal(profile.ariseSync.deletedGoalIds,undefined);
  const persisted=JSON.parse(localStorage.getItem('arise.finance.production.v1.account.user-a'));
  assert.equal(persisted.profiles[0].ariseSync.outbox[0].entity,'goal');
});

test('silent remote hydration does not manufacture deletion outbox mutations',()=>{
  const {context}=bootLocalStore();
  context.state.profiles[0].categories=[];
  context.state.profiles[0].goals=[];
  context.ARISE_SYNC_SILENT=true;
  context.saveState();
  context.ARISE_SYNC_SILENT=false;
  assert.equal(context.ARISE_SYNC_OUTBOX.list(context.state.profiles[0]).length,0);
});

function bootSyncEngine(){
  const context={console,navigator:{onLine:true},setTimeout,clearTimeout,state:{profiles:[]}};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('sync-outbox.js','utf8'),context);
  vm.runInContext(fs.readFileSync('sync-engine.js','utf8'),context);
  return context;
}

test('legacy category tombstones migrate to the unified outbox without a direct remote delete',async()=>{
  const context=bootSyncEngine();
  const profile={ariseSync:{deletedCategoryIds:['33333333-3333-4333-8333-333333333333']}};
  const count=await context.ARISE_SYNC.applyCategoryTombstones(profile,'ignored-profile-id');
  assert.equal(count,1);
  assert.equal(profile.ariseSync.deletedCategoryIds,undefined);
  const mutation=context.ARISE_SYNC_OUTBOX.list(profile,'category')[0];
  assert.equal(mutation.action,'delete');
  assert.equal(mutation.entityLocalId,null);
  assert.equal(mutation.entityRemoteId,'33333333-3333-4333-8333-333333333333');
});

test('legacy goal tombstones migrate to the unified outbox without a direct remote delete',async()=>{
  const context=bootSyncEngine();
  const profile={ariseSync:{deletedGoalIds:['66666666-6666-4666-8666-666666666666']}};
  const count=await context.ARISE_SYNC.applyGoalTombstones(profile,'ignored-profile-id');
  assert.equal(count,1);
  assert.equal(profile.ariseSync.deletedGoalIds,undefined);
  const mutation=context.ARISE_SYNC_OUTBOX.list(profile,'goal')[0];
  assert.equal(mutation.action,'delete');
  assert.equal(mutation.entityLocalId,null);
  assert.equal(mutation.entityRemoteId,'66666666-6666-4666-8666-666666666666');
});

test('legacy migration is idempotent and deduplicates repeated remote ids',()=>{
  const context=bootSyncEngine();
  const profile={ariseSync:{deletedCategoryIds:['33333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333']}};
  assert.equal(context.ARISE_SYNC.applyCategoryTombstones(profile),1);
  assert.equal(context.ARISE_SYNC.applyCategoryTombstones(profile),0);
  assert.equal(context.ARISE_SYNC_OUTBOX.list(profile,'category').length,1);
});

test('sync engine contains no direct category/goal tombstone delete write path',()=>{
  const source=fs.readFileSync('sync-engine.js','utf8');
  assert.equal(source.includes('from(table).delete()'),false);
  assert.match(source,/migrateEntityTombstones/);
  assert.match(source,/entityRemoteId:remoteIdValue/);
});
