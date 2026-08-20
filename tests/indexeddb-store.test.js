const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const idb=fs.readFileSync('indexeddb-store.js','utf8');
const local=fs.readFileSync('local-account-store.js','utf8');

test('IndexedDB layer stores account domain in structured entity stores',()=>{
  for(const token of [
    'accounts:"accounts"',
    'profiles:"profiles"',
    'categories:"categories"',
    'goals:"goals"',
    'transactions:"transactions"',
    'meta:"meta"',
    'saveState(accountId,nextState)',
    'loadState(accountId)',
    'deleteAccount(accountId)'
  ]) assert.ok(idb.includes(token),token+' missing');
});

test('IndexedDB never persists plaintext account password',()=>{
  assert.ok(idb.includes('delete cloneValue.account.password'));
  assert.equal(/password\s*:\s*nextState/.test(idb),false);
});

test('local state writes mirror into IndexedDB without replacing synchronous fallback',()=>{
  assert.ok(local.includes('localStorage.setItem(key,JSON.stringify(state))'));
  assert.ok(local.includes('idb.saveState(activeAccountId,state)'));
  assert.ok(local.includes('console.error("ARISE IndexedDB mirror",error)'));
});
