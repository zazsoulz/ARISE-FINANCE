const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const fx=require('../currency-engine.js');
const reconcile=require('../expense-reconciliation.js');
const runtime=fs.readFileSync('currency-runtime.js','utf8');

const book={base:'USD',rates:{USD:1,EUR:0.8,RUB:80},fetchedAt:'2026-08-20T00:00:00.000Z',source:'test'};

test('foreign expense is converted to profile base before overspend reconciliation',()=>{
  const snap=fx.snapshot(100,'EUR','RUB',book);
  assert.equal(snap.baseAmount,10000);
  const funding=reconcile.reconcileExpense({amount:snap.baseAmount,categoryId:null,availableUnallocated:8000,availableCategory:0});
  assert.equal(funding.controlledAmount,8000);
  assert.equal(funding.uncontrolledAmount,2000);
});

test('currency runtime previews and saves expense only after base-currency conversion is available',()=>{
  for(const token of [
    'function expenseFormSnapshot()',
    'root.updateExpensePreview=function()',
    'ARISE_EXPENSE_FUNDING.expenseFunding',
    'amount:snap.baseAmount',
    'Сначала обнови курс валюты для этого расхода.',
    'root.saveExpenseFromModal=function()'
  ]) assert.ok(runtime.includes(token),token+' missing');
});
