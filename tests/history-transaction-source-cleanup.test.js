const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  HISTORY_TRANSACTION_BOUNDARY,
  CATEGORY_EDITOR_BOUNDARY,
  removeHistoryTransactionSource
}=require('../scripts/remove-history-transaction-source.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const inspector=fs.readFileSync('history-inspector.js','utf8');

test('canonical history transaction row is owned outside the compatibility shell',()=>{
  assert.match(inspector,/function\s+historyTransaction\s*\(tx\)/);
  assert.match(inspector,/root\.historyTransaction=historyTransaction/);
  assert.match(shell,/function\s+historyTransaction\s*\(tx\)/,'legacy copy should remain until physical cleanup PR');
});

test('cleanup removes only legacy historyTransaction and preserves category editor boundary',()=>{
  const cleaned=removeHistoryTransactionSource(shell);
  assert.notEqual(cleaned,shell);
  assert.doesNotMatch(cleaned,/\bfunction\s+historyTransaction\s*\(tx\)/);
  assert.match(cleaned,/\bfunction\s+categoryEditor\s*\(category\)/);
  assert.match(cleaned,/\bfunction\s+showGoalFundModal\s*\(/);
  assert.match(cleaned,/<!doctype html>/i);
  assert.match(cleaned,/<\/html>/i);
});

test('cleanup is idempotent after physical removal',()=>{
  const cleaned=removeHistoryTransactionSource(shell);
  assert.equal(removeHistoryTransactionSource(cleaned),cleaned);
});

test('cleanup fails closed when an unexpected helper appears in the target block',()=>{
  const start=shell.indexOf(HISTORY_TRANSACTION_BOUNDARY);
  assert.ok(start>=0,'historyTransaction boundary missing');
  const injected=shell.slice(0,start+HISTORY_TRANSACTION_BOUNDARY.length)+
    '\nfunction sharedUnexpectedHistoryHelper(){}\n'+
    shell.slice(start+HISTORY_TRANSACTION_BOUNDARY.length);
  assert.throws(
    ()=>removeHistoryTransactionSource(injected),
    /unexpected helper sharedUnexpectedHistoryHelper/
  );
});

test('cleanup fails closed when category editor boundary is damaged',()=>{
  const end=shell.indexOf(CATEGORY_EDITOR_BOUNDARY);
  assert.ok(end>=0,'categoryEditor boundary missing');
  const damaged=shell.slice(0,end)+'function categoryEditorDamaged(category){'+shell.slice(end+CATEGORY_EDITOR_BOUNDARY.length);
  assert.throws(
    ()=>removeHistoryTransactionSource(damaged),
    /categoryEditor boundary missing/
  );
});
