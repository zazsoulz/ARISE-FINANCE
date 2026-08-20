const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function loadOutbox(){
  const context={console};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('sync-outbox.js','utf8'),context);
  return context.ARISE_SYNC_OUTBOX;
}

test('transaction outbox deduplicates by entity and keeps the latest intended action',()=>{
  const outbox=loadOutbox();
  const profile={ariseSync:{}};
  outbox.enqueue(profile,{entity:'transaction',entityLocalId:'tx-1',action:'upsert'});
  outbox.enqueue(profile,{entity:'transaction',entityLocalId:'tx-1',entityRemoteId:'remote-1',action:'delete'});
  const items=outbox.list(profile,'transaction');
  assert.equal(items.length,1);
  assert.equal(items[0].id,'transaction:tx-1');
  assert.equal(items[0].action,'delete');
  assert.equal(items[0].entityRemoteId,'remote-1');
});

test('outbox records new changed and deleted transactions without queue duplication',()=>{
  const outbox=loadOutbox();
  const previous={transactions:[
    {id:'same',type:'expense',amount:10},
    {id:'changed',type:'expense',amount:20},
    {id:'deleted',type:'income',amount:30,ariseSync:{remoteId:'remote-deleted'}}
  ]};
  const next={transactions:[
    {id:'same',type:'expense',amount:10},
    {id:'changed',type:'expense',amount:25},
    {id:'new',type:'income',amount:40}
  ]};
  assert.equal(outbox.recordTransactionChanges(previous,next),3);
  const byId=Object.fromEntries(outbox.list(next,'transaction').map(item=>[item.entityLocalId,item]));
  assert.deepEqual(Object.keys(byId).sort(),['changed','deleted','new']);
  assert.equal(byId.changed.action,'upsert');
  assert.equal(byId.new.action,'upsert');
  assert.equal(byId.deleted.action,'delete');
  assert.equal(byId.deleted.entityRemoteId,'remote-deleted');
});

test('category and goal changes use the same persistent mutation queue',()=>{
  const outbox=loadOutbox();
  const previous={
    categories:[
      {id:'cat-same',name:'Семья',percent:10},
      {id:'cat-change',name:'Жизнь',percent:15},
      {id:'cat-delete',name:'Старое',percent:5,ariseSync:{remoteId:'remote-cat-delete'}}
    ],
    goals:[
      {id:'goal-change',name:'Отпуск',target:100000},
      {id:'goal-delete',name:'Старая цель',target:50000,ariseSync:{remoteId:'remote-goal-delete'}}
    ]
  };
  const next={
    categories:[
      {id:'cat-same',name:'Семья',percent:10},
      {id:'cat-change',name:'Жизнь',percent:20},
      {id:'cat-new',name:'Творчество',percent:10}
    ],
    goals:[
      {id:'goal-change',name:'Отпуск',target:150000},
      {id:'goal-new',name:'Подушка',target:300000}
    ]
  };

  assert.equal(outbox.recordCategoryChanges(previous,next),3);
  assert.equal(outbox.recordGoalChanges(previous,next),3);

  const categories=Object.fromEntries(outbox.list(next,'category').map(item=>[item.entityLocalId,item]));
  const goals=Object.fromEntries(outbox.list(next,'goal').map(item=>[item.entityLocalId,item]));

  assert.deepEqual(Object.keys(categories).sort(),['cat-change','cat-delete','cat-new']);
  assert.equal(categories['cat-delete'].action,'delete');
  assert.equal(categories['cat-delete'].entityRemoteId,'remote-cat-delete');
  assert.deepEqual(Object.keys(goals).sort(),['goal-change','goal-delete','goal-new']);
  assert.equal(goals['goal-delete'].action,'delete');
  assert.equal(goals['goal-delete'].entityRemoteId,'remote-goal-delete');
});

test('failed mutation stays queued and ack removes only the confirmed mutation',()=>{
  const outbox=loadOutbox();
  const profile={};
  const first=outbox.enqueue(profile,{entity:'transaction',entityLocalId:'a',action:'upsert'});
  outbox.enqueue(profile,{entity:'transaction',entityLocalId:'b',action:'upsert'});
  outbox.fail(profile,first.id,new Error('offline'));
  assert.equal(outbox.list(profile)[0].attempts,1);
  assert.equal(outbox.list(profile)[0].lastError,'offline');
  assert.equal(outbox.ack(profile,first.id),true);
  assert.deepEqual([...outbox.list(profile).map(item=>item.entityLocalId)],['b']);
});
