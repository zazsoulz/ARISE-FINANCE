const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const expenseEdit=fs.readFileSync('expense-edit-ui.js','utf8');

test('history expense edit behavior stays consolidated into expense edit UI',()=>{
  assert.equal(fs.existsSync('history-expense-edit-hook.js'),false);
  assert.equal(index.includes('./history-expense-edit-hook.js'),false);
  assert.equal(expenseEdit.includes('data-history-edit-expense'),true);
  assert.equal(expenseEdit.includes('ARISE_HISTORY_EXPENSE_EDIT'),true);
});

test('expense edit runtime still loads before currency display and sync layers',()=>{
  const edit=index.indexOf('./expense-edit-ui.js');
  const currency=index.indexOf('./currency-display.js');
  const outbox=index.indexOf('./sync-outbox.js');
  assert.ok(edit>=0);
  assert.ok(currency>edit);
  assert.ok(outbox>currency);
});
