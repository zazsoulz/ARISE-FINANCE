const test=require('node:test');
const assert=require('node:assert/strict');
const reconciliation=require('../expense-reconciliation.js');

test('unallocated expense splits controlled and uncontrolled amounts',()=>{
  assert.deepEqual(
    reconciliation.reconcileExpense({amount:30000,availableUnallocated:20000}),
    {
      fundingSource:'unallocated',
      fundingSourceId:null,
      controlledAmount:20000,
      uncontrolledAmount:10000
    }
  );
});

test('unallocated expense is fully controlled when balance covers it',()=>{
  assert.deepEqual(
    reconciliation.reconcileExpense({amount:12000,availableUnallocated:20000}),
    {
      fundingSource:'unallocated',
      fundingSourceId:null,
      controlledAmount:12000,
      uncontrolledAmount:0
    }
  );
});

test('explicit category remains a typed funding source',()=>{
  assert.deepEqual(
    reconciliation.reconcileExpense({amount:8500,categoryId:'food',availableUnallocated:50000}),
    {
      fundingSource:'category',
      fundingSourceId:'food',
      controlledAmount:8500,
      uncontrolledAmount:0
    }
  );
});

test('invalid and negative values cannot create money',()=>{
  assert.deepEqual(
    reconciliation.reconcileExpense({amount:-100,availableUnallocated:-500}),
    {
      fundingSource:'unallocated',
      fundingSourceId:null,
      controlledAmount:0,
      uncontrolledAmount:0
    }
  );
});
