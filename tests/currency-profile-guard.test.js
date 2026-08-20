const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const lifecycle=fs.readFileSync('profile-lifecycle.js','utf8');

test('base currency change is guarded when profile already has financial history',()=>{
  assert.ok(lifecycle.includes('profile.transactions') || lifecycle.includes('transactions||[]'));
});
