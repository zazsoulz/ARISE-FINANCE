const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(){
  const tx={id:'t1',type:'goal_withdrawal',sourceAccount:'goal',destinationAccount:'reserve',sourceGoalId:'g1',targetGoalId:'g2',fundingBreakdown:{}};
  const state={profiles:[{id:'p1',transactions:[tx]}]};
  let pushed=0,pulled=0,saved=0;
  const ctx={
    console,globalThis:null,window:null,state,
    ARISE_SYNC:{pushAll:async()=>{pushed++;return {status:'synced'};}},
    ARISE_SYNC_PULL:{pullAll:async()=>{pulled++;return {status:'pulled'};}},
    saveState:()=>{saved++;}
  };
  ctx.globalThis=ctx;ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('transaction-transfer-metadata.js','utf8'),ctx,{filename:'transaction-transfer-metadata.js'});
  return {ctx,tx,get:()=>({pushed,pulled,saved})};
}

test('transfer semantics are embedded into existing fundingBreakdown before push',async()=>{
  const {ctx,tx,get}=boot();
  await ctx.ARISE_SYNC.pushAll();
  assert.deepEqual(JSON.parse(JSON.stringify(tx.fundingBreakdown.transfer)),{
    sourceAccount:'goal',destinationAccount:'reserve',sourceGoalId:'g1',targetGoalId:'g2'
  });
  assert.equal(get().pushed,1);
});

test('pull restores missing top-level transfer fields from payload metadata',async()=>{
  const {ctx,tx,get}=boot();
  ctx.ARISE_TRANSACTION_TRANSFER_METADATA.embed(tx);
  delete tx.sourceAccount;delete tx.destinationAccount;delete tx.sourceGoalId;delete tx.targetGoalId;
  await ctx.ARISE_SYNC_PULL.pullAll();
  assert.equal(tx.sourceAccount,'goal');
  assert.equal(tx.destinationAccount,'reserve');
  assert.equal(tx.sourceGoalId,'g1');
  assert.equal(tx.targetGoalId,'g2');
  assert.equal(get().pulled,1);
  assert.equal(get().saved,1);
});

test('ordinary expense metadata is left untouched',()=>{
  const {ctx}=boot();
  const expense={id:'e1',type:'expense',fundingBreakdown:{category:5000}};
  assert.equal(ctx.ARISE_TRANSACTION_TRANSFER_METADATA.embed(expense),false);
  assert.deepEqual(JSON.parse(JSON.stringify(expense.fundingBreakdown)),{category:5000});
});
