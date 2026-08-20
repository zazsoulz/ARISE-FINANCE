const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const display=fs.readFileSync('currency-display.js','utf8');

test('foreign history keeps operation in original currency and ledger breakdown in base currency',()=>{
  for(const token of [
    'money(original.amount,original.currency)',
    'money(item.amount,base)',
    'money(tx.reserve,base)',
    'money(categoryAmount,base)',
    'money(unallocatedAmount,base)',
    'money(uncontrolledAmount,base)',
    'НЕ РАСПРЕДЕЛЕНО'
  ]) assert.ok(display.includes(token),token+' missing');
});
