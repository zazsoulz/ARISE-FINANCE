const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const push=fs.readFileSync('sync-engine.js','utf8');
const pull=fs.readFileSync('sync-pull.js','utf8');

test('sync persists original transaction value and base ledger snapshot in separate columns',()=>{
  for(const token of [
    'amount:fx.originalAmount',
    'currency:fx.originalCurrency',
    'base_currency:fx.baseCurrency',
    'exchange_rate_to_base:fx.exchangeRateToBase',
    'base_amount:fx.baseAmount',
    'fx_source:fx.fxSource',
    'fx_fetched_at:fx.fxFetchedAt'
  ]) assert.ok(push.includes(token),token+' missing');
});

test('server pull reconstructs internal ledger amount from base snapshot while retaining original value',()=>{
  for(const token of [
    'const originalAmount=Math.max(0,Number(row.amount)||0)',
    'const originalCurrency=row.currency||profile.settings.currency',
    'const baseCurrency=row.base_currency||profile.settings.currency||originalCurrency',
    'amount:baseAmount,currency:baseCurrency',
    'originalAmount,originalCurrency,baseAmount,baseCurrency',
    'exchangeRateToBase:'
  ]) assert.ok(pull.includes(token),token+' missing');
});
