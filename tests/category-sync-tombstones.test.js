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
  const context={
    console,
    localStorage,
    STORAGE_KEY:'arise.finance.production.v1',
    state:JSON.parse(JSON.stringify(initial)),
    clone:value=>JSON.parse(JSON.stringify(value)),
    normalizeState:value=>value,
    defaultState:()=>({version:1,account:{registered:false},profiles:[],activeProfileId:null})
  };
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('local-account-store.js','utf8'),context);
  context.ARISE_LOCAL_ACCOUNTS.activate('user-a');
  return {context,localStorage};
}

test('deleting a synced category records a persistent server tombstone',()=>{
  const {context,localStorage}=bootLocalStore();
  context.state.profiles[0].categories=[];
  context.saveState();

  const profile=context.state.profiles[0];
  assert.deepEqual(
    [...profile.ariseSync.deletedCategoryIds],
    ['11111111-1111-4111-8111-111111111111']
  );
  assert.equal(profile.ariseSync.dirty,true);

  const persisted=JSON.parse(localStorage.getItem('arise.finance.production.v1.account.user-a'));
  assert.deepEqual(
    persisted.profiles[0].ariseSync.deletedCategoryIds,
    ['11111111-1111-4111-8111-111111111111']
  );
});

test('deleting a synced goal records a persistent server tombstone',()=>{
  const {context,localStorage}=bootLocalStore();
  context.state.profiles[0].goals=[];
  context.saveState();

  const profile=context.state.profiles[0];
  assert.deepEqual(
    [...profile.ariseSync.deletedGoalIds],
    ['55555555-5555-4555-8555-555555555555']
  );
  assert.equal(profile.ariseSync.dirty,true);

  const persisted=JSON.parse(localStorage.getItem('arise.finance.production.v1.account.user-a'));
  assert.deepEqual(
    persisted.profiles[0].ariseSync.deletedGoalIds,
    ['55555555-5555-4555-8555-555555555555']
  );
});

test('silent remote hydration does not manufacture deletion tombstones',()=>{
  const {context}=bootLocalStore();
  context.state.profiles[0].categories=[];
  context.state.profiles[0].goals=[];
  context.ARISE_SYNC_SILENT=true;
  context.saveState();
  context.ARISE_SYNC_SILENT=false;
  assert.equal(context.state.profiles[0].ariseSync.deletedCategoryIds,undefined);
  assert.equal(context.state.profiles[0].ariseSync.deletedGoalIds,undefined);
});

function bootSyncEngine(expectedTable){
  const calls=[];
  const query={
    delete(){calls.push(['delete']);return this;},
    eq(column,value){calls.push(['eq',column,value]);return this;},
    then(resolve){resolve({error:null});}
  };
  const context={
    console,
    navigator:{onLine:true},
    setTimeout,
    clearTimeout,
    state:{profiles:[]},
    ARISE_SUPABASE:{
      getClient:()=>({from:table=>{assert.equal(table,expectedTable);return query;}}),
      currentSession:()=>null
    }
  };
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('sync-engine.js','utf8'),context);
  return {context,calls};
}

test('sync engine deletes tombstoned remote categories and clears the tombstone only after success',async()=>{
  const {context,calls}=bootSyncEngine('finance_categories');
  const profile={ariseSync:{deletedCategoryIds:['33333333-3333-4333-8333-333333333333']}};
  const count=await context.ARISE_SYNC.applyCategoryTombstones(profile,'44444444-4444-4444-8444-444444444444');
  assert.equal(count,1);
  assert.deepEqual([...profile.ariseSync.deletedCategoryIds],[]);
  assert.deepEqual(calls,[
    ['delete'],
    ['eq','id','33333333-3333-4333-8333-333333333333'],
    ['eq','profile_id','44444444-4444-4444-8444-444444444444']
  ]);
});

test('sync engine deletes tombstoned remote goals and clears the tombstone only after success',async()=>{
  const {context,calls}=bootSyncEngine('finance_goals');
  const profile={ariseSync:{deletedGoalIds:['66666666-6666-4666-8666-666666666666']}};
  const count=await context.ARISE_SYNC.applyGoalTombstones(profile,'77777777-7777-4777-8777-777777777777');
  assert.equal(count,1);
  assert.deepEqual([...profile.ariseSync.deletedGoalIds],[]);
  assert.deepEqual(calls,[
    ['delete'],
    ['eq','id','66666666-6666-4666-8666-666666666666'],
    ['eq','profile_id','77777777-7777-4777-8777-777777777777']
  ]);
});
