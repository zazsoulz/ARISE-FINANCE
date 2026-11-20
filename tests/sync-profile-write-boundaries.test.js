'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function makeClient(options={}){
  const calls=[];
  const client={from(table){
    const call={table,operation:'select',filters:[]};
    const builder={
      select(columns){call.columns=columns;return builder;},
      eq(column,value){call.filters.push([column,value]);return builder;},
      contains(column,value){call.contains=[column,value];return builder;},
      limit(value){call.limit=value;return builder;},
      update(payload){call.operation='update';call.payload=payload;return builder;},
      insert(payload){call.operation='insert';call.payload=payload;return builder;},
      delete(){call.operation='delete';return builder;},
      maybeSingle(){call.terminal='maybeSingle';calls.push(call);return Promise.resolve(options.maybeSingle?options.maybeSingle(call):{data:{id:'remote-row'},error:null});},
      single(){call.terminal='single';calls.push(call);return Promise.resolve(options.single?options.single(call):{data:{id:'remote-tx'},error:null});},
      then(resolve,reject){call.terminal='await';calls.push(call);return Promise.resolve(options.await?options.await(call):{data:[],error:null}).then(resolve,reject);}
    };
    return builder;
  }};
  return {client,calls};
}
function hasFilter(call,key,value){return call.filters.some(([field,actual])=>field===key&&actual===value);}

function bootEngine({mutations=[],clientOptions={}}={}){
  const {client,calls}=makeClient(clientOptions),acked=[],failed=[];
  const outbox={
    list(_profile,entity){return mutations.filter(item=>!entity||item.entity===entity);},
    enqueue(_profile,mutation){mutations.push({...mutation,id:String(mutation.entity)+':'+String(mutation.entityLocalId)});},
    ack(_profile,id){acked.push(id);},
    fail(_profile,id,error){failed.push({id,message:String(error&&error.message||error)});}
  };
  const context=vm.createContext({
    console,navigator:{onLine:true},state:{profiles:[]},saveState(){},
    ARISE_SUPABASE:{getClient:()=>client,currentSession:()=>({user:{id:'user-1'}}),listFinanceProfiles:async()=>[]},
    ARISE_SYNC_OUTBOX:outbox,
    ARISE_ENTITY_OUTBOX:{drainProfile:async()=>0}
  });
  context.globalThis=context;
  vm.runInContext(fs.readFileSync('sync-engine.js','utf8'),context,{filename:'sync-engine.js'});
  return {context,calls,acked,failed};
}

function bootEntityOutbox(options={}){
  const {client,calls}=makeClient(options),acked=[],failed=[];
  const context=vm.createContext({
    console,navigator:{onLine:true},setTimeout,clearTimeout,
    ARISE_SUPABASE:{getClient:()=>client,currentSession:()=>({user:{id:'user-1'}})},
    ARISE_SYNC_OUTBOX:{list:()=>[],ack:(_profile,id)=>acked.push(id),fail:(_profile,id,error)=>failed.push({id,message:error.message})}
  });
  context.globalThis=context;
  vm.runInContext(fs.readFileSync('sync-entity-outbox.js','utf8'),context,{filename:'sync-entity-outbox.js'});
  return {context,calls,acked,failed};
}

function transaction(overrides={}){
  return {id:'tx-local',type:'income',date:'2026-11-20',amount:100,currency:'RUB',allocations:[],goalAllocations:[],reserve:0,remainder:0,ariseSync:{remoteId:'remote-tx',dirty:true},...overrides};
}

test('transaction upsert scopes the ledger row and allocation replacement to its profile',async()=>{
  const mutations=[{id:'transaction:tx-local',entity:'transaction',entityLocalId:'tx-local',entityRemoteId:'remote-tx',action:'upsert'}];
  const {context,calls}=bootEngine({mutations});
  const profile={settings:{currency:'RUB'},categories:[],goals:[],transactions:[transaction()]};
  await context.ARISE_SYNC.flushTransactionOutbox(profile,'profile-a',{id:'user-1'});
  const update=calls.find(call=>call.table==='finance_transactions'&&call.operation==='update');
  assert.ok(update);
  assert.ok(hasFilter(update,'id','remote-tx'));
  assert.ok(hasFilter(update,'profile_id','profile-a'));
  assert.ok(hasFilter(update,'user_id','user-1'));
  const allocationDelete=calls.find(call=>call.table==='finance_allocations'&&call.operation==='delete');
  assert.ok(allocationDelete);
  assert.ok(hasFilter(allocationDelete,'transaction_id','remote-tx'));
  assert.ok(hasFilter(allocationDelete,'profile_id','profile-a'));
  assert.ok(hasFilter(allocationDelete,'user_id','user-1'));
});

test('a stale remote transaction id from another profile is fenced before allocations can be touched',async()=>{
  const mutations=[{id:'transaction:tx-local',entity:'transaction',entityLocalId:'tx-local',entityRemoteId:'remote-tx',action:'upsert'}];
  const {context,calls,failed}=bootEngine({
    mutations,
    clientOptions:{single(call){
      if(call.table==='finance_transactions'&&call.operation==='update'&&hasFilter(call,'profile_id','profile-b')&&hasFilter(call,'user_id','user-1')){
        return {data:null,error:{message:'transaction is not in the active profile'}};
      }
      return {data:{id:'remote-tx'},error:null};
    }}
  });
  const profile={settings:{currency:'RUB'},categories:[],goals:[],transactions:[transaction()]};
  await assert.rejects(
    ()=>context.ARISE_SYNC.flushTransactionOutbox(profile,'profile-b',{id:'user-1'}),
    error=>error&&error.message==='transaction is not in the active profile'
  );
  assert.equal(calls.some(call=>call.table==='finance_allocations'),false);
  assert.equal(failed.length,1);
});

test('transaction delete is constrained to the active profile and account',async()=>{
  const mutations=[{id:'transaction:tx-local',entity:'transaction',entityLocalId:'tx-local',entityRemoteId:'remote-tx',action:'delete'}];
  const {context,calls}=bootEngine({mutations});
  const profile={settings:{currency:'RUB'},categories:[],goals:[],transactions:[]};
  await context.ARISE_SYNC.flushTransactionOutbox(profile,'profile-a',{id:'user-1'});
  const deletion=calls.find(call=>call.table==='finance_transactions'&&call.operation==='delete');
  assert.ok(deletion);
  assert.ok(hasFilter(deletion,'id','remote-tx'));
  assert.ok(hasFilter(deletion,'profile_id','profile-a'));
  assert.ok(hasFilter(deletion,'user_id','user-1'));
});

test('transaction idempotency lookups cannot match another profile',async()=>{
  const localId='11111111-1111-4111-8111-111111111111';
  const mutations=[{id:'transaction:'+localId,entity:'transaction',entityLocalId:localId,entityRemoteId:null,action:'upsert'}];
  const {context,calls}=bootEngine({mutations,clientOptions:{maybeSingle:()=>({data:null,error:null})}});
  const profile={settings:{currency:'RUB'},categories:[],goals:[],transactions:[transaction({id:localId,ariseSync:{dirty:true}})]};
  await context.ARISE_SYNC.flushTransactionOutbox(profile,'profile-b',{id:'user-1'});
  const mutationLookup=calls.find(call=>call.table==='finance_transactions'&&call.terminal==='maybeSingle');
  assert.ok(mutationLookup);
  assert.ok(hasFilter(mutationLookup,'user_id','user-1'));
  assert.ok(hasFilter(mutationLookup,'profile_id','profile-b'));
  const legacyLookup=calls.find(call=>call.table==='finance_transactions'&&call.columns==='id,payload');
  assert.ok(legacyLookup);
  assert.ok(hasFilter(legacyLookup,'user_id','user-1'));
  assert.ok(hasFilter(legacyLookup,'profile_id','profile-b'));
});

test('profile metadata update is scoped to the authenticated account',async()=>{
  const {context,calls}=bootEngine();
  const profile={id:'local-profile',name:'Основной',settings:{currency:'RUB'},categories:[],goals:[],transactions:[],ariseSync:{remoteId:'remote-profile'}};
  context.state.profiles=[profile];
  await context.ARISE_SYNC.pushAll();
  const update=calls.find(call=>call.table==='finance_profiles'&&call.operation==='update');
  assert.ok(update);
  assert.ok(hasFilter(update,'id','remote-profile'));
  assert.ok(hasFilter(update,'user_id','user-1'));
  assert.equal(update.columns,'id');
  assert.equal(update.terminal,'maybeSingle');
});

test('sync stops before draining profile data when the remote profile row is unavailable to the authenticated owner',async()=>{
  const {context,calls}=bootEngine({
    clientOptions:{maybeSingle(call){
      if(call.table==='finance_profiles'&&call.operation==='update')return {data:null,error:null};
      return {data:{id:'remote-row'},error:null};
    }}
  });
  const profile={id:'local-profile',name:'Основной',settings:{currency:'RUB'},categories:[],goals:[],transactions:[],ariseSync:{remoteId:'missing-profile'}};
  context.state.profiles=[profile];

  await assert.rejects(
    ()=>context.ARISE_SYNC.pushAll(),
    /Финансовый профиль не найден для текущего аккаунта/
  );
  assert.equal(calls.length,1);
  assert.equal(calls[0].table,'finance_profiles');
  assert.equal(calls[0].operation,'update');
  assert.ok(hasFilter(calls[0],'id','missing-profile'));
  assert.ok(hasFilter(calls[0],'user_id','user-1'));
  assert.equal(calls[0].terminal,'maybeSingle');
});

test('category and goal outbox updates include both profile and account ownership filters',async()=>{
  const {context,calls}=bootEntityOutbox();
  const profile={
    settings:{currency:'RUB'},
    categories:[{id:'cat-local',name:'Семья',type:'percentage',percent:15,priority:3,enabled:true,ariseSync:{remoteId:'cat-remote',dirty:true}}],
    goals:[{id:'goal-local',name:'Резервный фонд',target:10000,ledgerStart:0,status:'active',ariseSync:{remoteId:'goal-remote',dirty:true}}]
  };
  await context.ARISE_ENTITY_OUTBOX.processMutation(profile,'profile-a','user-1',{id:'category:cat-local',entity:'category',entityLocalId:'cat-local',entityRemoteId:'cat-remote',action:'upsert'});
  await context.ARISE_ENTITY_OUTBOX.processMutation(profile,'profile-a','user-1',{id:'goal:goal-local',entity:'goal',entityLocalId:'goal-local',entityRemoteId:'goal-remote',action:'upsert'});
  const categoryUpdate=calls.find(call=>call.table==='finance_categories'&&call.operation==='update');
  const goalUpdate=calls.find(call=>call.table==='finance_goals'&&call.operation==='update');
  for(const update of [categoryUpdate,goalUpdate]){
    assert.ok(update);
    assert.ok(hasFilter(update,'profile_id','profile-a'));
    assert.ok(hasFilter(update,'user_id','user-1'));
  }
});

test('category and goal deletes include both profile and account ownership filters',async()=>{
  const {context,calls}=bootEntityOutbox();
  const profile={settings:{currency:'RUB'},categories:[],goals:[]};
  await context.ARISE_ENTITY_OUTBOX.processMutation(profile,'profile-a','user-1',{id:'category:cat-local',entity:'category',entityLocalId:'cat-local',entityRemoteId:'cat-remote',action:'delete'});
  await context.ARISE_ENTITY_OUTBOX.processMutation(profile,'profile-a','user-1',{id:'goal:goal-local',entity:'goal',entityLocalId:'goal-local',entityRemoteId:'goal-remote',action:'delete'});
  const deletions=calls.filter(call=>['finance_categories','finance_goals'].includes(call.table)&&call.operation==='delete');
  assert.equal(deletions.length,2);
  for(const deletion of deletions){
    assert.ok(hasFilter(deletion,'profile_id','profile-a'));
    assert.ok(hasFilter(deletion,'user_id','user-1'));
  }
});


function bootSupabaseClient(){
  const calls=[];
  const fakeSupabase={
    auth:{getUser:async()=>({data:{user:{id:'user-1'}},error:null})},
    from(table){
      const call={table,operation:'select',filters:[]};
      const builder={
        select(columns){call.columns=columns;return builder;},
        update(payload){call.operation='update';call.payload=payload;return builder;},
        eq(column,value){call.filters.push([column,value]);return builder;},
        is(column,value){call.filters.push([column,'is:'+value]);return builder;},
        not(column,operator,value){call.filters.push([column,'not:'+operator+':'+value]);return builder;},
        order(column,options){call.order={column,options};return builder;},
        single(){call.terminal='single';calls.push(call);return Promise.resolve({data:{id:'profile-result'},error:null});},
        then(resolve,reject){call.terminal='await';calls.push(call);return Promise.resolve({data:[{id:'profile-a'},{id:'profile-b'}],error:null}).then(resolve,reject);}
      };
      return builder;
    }
  };
  const context=vm.createContext({
    console,
    ARISE_SUPABASE_CONFIG:{url:'https://example.supabase.co',publishableKey:'sb_publishable_test'},
    supabase:{createClient:()=>fakeSupabase}
  });
  context.globalThis=context;
  vm.runInContext(fs.readFileSync('supabase-client.js','utf8'),context,{filename:'supabase-client.js'});
  return {context,calls};
}

test('profile update, archive and restore APIs constrain mutations to the authenticated owner',async()=>{
  const {context,calls}=bootSupabaseClient();
  await context.ARISE_SUPABASE.updateFinanceProfile('profile-update',{name:'Updated'});
  await context.ARISE_SUPABASE.archiveFinanceProfile('profile-archive');
  await context.ARISE_SUPABASE.restoreFinanceProfile('profile-restore');

  const writes=calls.filter(call=>call.table==='finance_profiles'&&call.operation==='update');
  assert.equal(writes.length,3);
  assert.ok(hasFilter(writes[0],'id','profile-update'));
  assert.ok(hasFilter(writes[1],'id','profile-archive'));
  assert.ok(hasFilter(writes[2],'id','profile-restore'));
  for(const write of writes)assert.ok(hasFilter(write,'user_id','user-1'));
});
