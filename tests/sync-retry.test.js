const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function makeThenable(result){
  return {
    then(resolve,reject){return Promise.resolve(result).then(resolve,reject);},
    catch(reject){return Promise.resolve(result).catch(reject);}
  };
}

function makeQuery(table,state,mode,payload){
  const filters=[];
  const query={
    eq(column,value){filters.push([column,value]);return query;},
    contains(column,value){filters.push([column,value]);return query;},
    limit(){return execute();},
    select(){return query;},
    single(){return execute(true);},
    maybeSingle(){return execute(true);},
    then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);},
    catch(reject){return Promise.resolve(execute()).catch(reject);}
  };

  function matches(row){
    return filters.every(([column,value])=>{
      if(column==='payload'&&value&&typeof value==='object'){
        return Object.entries(value).every(([key,expected])=>row.payload&&row.payload[key]===expected);
      }
      return row[column]===value;
    });
  }

  function execute(single=false){
    if(table==='finance_transactions'){
      if(mode==='select'){
        const rows=state.transactions.filter(matches);
        return {data:single?(rows[0]||null):rows.map(row=>({id:row.id,payload:row.payload})),error:null};
      }
      if(mode==='insert'){
        state.transactionInserts++;
        const row={...payload,id:'remote-tx-1'};
        state.transactions.push(row);
        return {data:{id:row.id},error:null};
      }
      if(mode==='update'){
        state.transactionUpdates++;
        const row=state.transactions.find(matches);
        if(row)Object.assign(row,payload);
        return {data:row?{id:row.id}:null,error:row?null:new Error('missing transaction')};
      }
      if(mode==='delete'){
        state.transactions=state.transactions.filter(row=>!matches(row));
        return {data:null,error:null};
      }
    }

    if(table==='finance_allocations'&&mode==='delete'){
      state.allocationDeletes++;
      if(state.failNextAllocationDelete){
        state.failNextAllocationDelete=false;
        return {data:null,error:new Error('connection lost after transaction write')};
      }
      return {data:null,error:null};
    }

    if(table==='finance_allocations'&&mode==='insert'){
      state.allocationInserts++;
      return {data:null,error:null};
    }

    return {data:single?null:[],error:null};
  }

  return query;
}

function boot(){
  const db={transactions:[],transactionInserts:0,transactionUpdates:0,allocationDeletes:0,allocationInserts:0,failNextAllocationDelete:true};
  const client={
    from(table){
      return {
        select(){return makeQuery(table,db,'select');},
        insert(payload){return makeQuery(table,db,'insert',Array.isArray(payload)?payload[0]:payload);},
        update(payload){return makeQuery(table,db,'update',payload);},
        delete(){return makeQuery(table,db,'delete');}
      };
    }
  };

  const context={console,navigator:{onLine:true},state:{profiles:[]}};
  context.globalThis=context;
  context.ARISE_SUPABASE={
    getClient:()=>client,
    currentSession:()=>({user:{id:'user-1'}})
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('sync-outbox.js','utf8'),context);
  vm.runInContext(fs.readFileSync('sync-engine.js','utf8'),context);
  return {context,db};
}

test('retry after partial remote success reuses the same transaction instead of inserting a duplicate',async()=>{
  const {context,db}=boot();
  const profile={
    settings:{currency:'RUB'},
    categories:[],
    goals:[],
    transactions:[{
      id:'local-tx-1',
      type:'income',
      amount:1000,
      currency:'RUB',
      date:'2026-08-20',
      allocations:[],
      goalAllocations:[],
      reserve:0,
      remainder:1000
    }]
  };
  const tx=profile.transactions[0];
  context.ARISE_SYNC_OUTBOX.enqueue(profile,{entity:'transaction',entityLocalId:tx.id,action:'upsert'});

  await assert.rejects(
    context.ARISE_SYNC.flushTransactionOutbox(profile,'profile-1',{id:'user-1'}),
    /connection lost after transaction write/
  );

  assert.equal(db.transactionInserts,1);
  assert.equal(db.transactions.length,1);
  assert.equal(profile.ariseSync.outbox.length,1);
  assert.equal(profile.ariseSync.outbox[0].attempts,1);
  assert.equal(tx.ariseSync.remoteId,'remote-tx-1');

  const flushed=await context.ARISE_SYNC.flushTransactionOutbox(profile,'profile-1',{id:'user-1'});
  assert.equal(flushed,1);
  assert.equal(db.transactionInserts,1,'retry must not insert a second remote transaction');
  assert.equal(db.transactionUpdates,1,'retry should update the already-created transaction');
  assert.equal(db.transactions.length,1);
  assert.equal(profile.ariseSync.outbox.length,0);
  assert.equal(db.allocationDeletes,2);
  assert.equal(db.allocationInserts,1);
});
