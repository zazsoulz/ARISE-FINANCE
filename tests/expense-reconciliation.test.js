const test=require('node:test');
const assert=require('node:assert/strict');
const reconciliation=require('../expense-reconciliation.js');

function expectSplit(result,expected){
  assert.equal(result.fundingSource,expected.fundingSource);
  assert.equal(result.fundingSourceId,expected.fundingSourceId);
  assert.equal(result.controlledAmount,expected.controlledAmount);
  assert.equal(result.categoryControlledAmount,expected.categoryControlledAmount);
  assert.equal(result.unallocatedControlledAmount,expected.unallocatedControlledAmount);
  assert.equal(result.uncontrolledAmount,expected.uncontrolledAmount);
  assert.deepEqual(result.fundingBreakdown,{category:expected.categoryControlledAmount,unallocated:expected.unallocatedControlledAmount,uncontrolled:expected.uncontrolledAmount});
}

test('unallocated expense splits controlled and uncontrolled amounts',()=>{
  expectSplit(reconciliation.reconcileExpense({amount:30000,availableUnallocated:20000}),{
    fundingSource:'unallocated',fundingSourceId:null,controlledAmount:20000,categoryControlledAmount:0,unallocatedControlledAmount:20000,uncontrolledAmount:10000
  });
});

test('unallocated expense is fully controlled when balance covers it',()=>{
  expectSplit(reconciliation.reconcileExpense({amount:12000,availableUnallocated:20000}),{
    fundingSource:'unallocated',fundingSourceId:null,controlledAmount:12000,categoryControlledAmount:0,unallocatedControlledAmount:12000,uncontrolledAmount:0
  });
});

test('explicit category uses its own balance first',()=>{
  expectSplit(reconciliation.reconcileExpense({amount:8500,categoryId:'food',availableCategory:10000,availableUnallocated:50000}),{
    fundingSource:'category',fundingSourceId:'food',controlledAmount:8500,categoryControlledAmount:8500,unallocatedControlledAmount:0,uncontrolledAmount:0
  });
});

test('category overspend automatically falls back to unallocated money',()=>{
  expectSplit(reconciliation.reconcileExpense({amount:30000,categoryId:'food',availableCategory:20000,availableUnallocated:50000}),{
    fundingSource:'category',fundingSourceId:'food',controlledAmount:30000,categoryControlledAmount:20000,unallocatedControlledAmount:10000,uncontrolledAmount:0
  });
});

test('only the part not covered by category or unallocated becomes uncontrolled',()=>{
  expectSplit(reconciliation.reconcileExpense({amount:30000,categoryId:'food',availableCategory:20000,availableUnallocated:5000}),{
    fundingSource:'category',fundingSourceId:'food',controlledAmount:25000,categoryControlledAmount:20000,unallocatedControlledAmount:5000,uncontrolledAmount:5000
  });
});

test('invalid and negative values cannot create money',()=>{
  expectSplit(reconciliation.reconcileExpense({amount:-100,availableUnallocated:-500}),{
    fundingSource:'unallocated',fundingSourceId:null,controlledAmount:0,categoryControlledAmount:0,unallocatedControlledAmount:0,uncontrolledAmount:0
  });
});
