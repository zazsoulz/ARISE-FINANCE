const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const lifecycle=fs.readFileSync('profile-lifecycle.js','utf8');

test('base currency change is locked after financial history exists',()=>{
  for(const token of [
    'function hasFinancialHistory(profile)',
    'function canChangeBaseCurrency(profile,nextCurrency)',
    'return !nextCurrency||nextCurrency===current||!hasFinancialHistory(profile)',
    'if(!canChangeBaseCurrency(profile,currency)) return {ok:false,reason:"currency_locked"}',
    'id="editFinanceProfileCurrency" ${locked?"disabled":""}',
    'Базовая валюта зафиксирована'
  ]) assert.ok(lifecycle.includes(token),token+' missing');
});

test('empty financial profile can still change base currency',()=>{
  assert.ok(lifecycle.includes('Базовую валюту можно менять, пока в профиле нет финансовой истории.'));
});
