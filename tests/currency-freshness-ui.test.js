const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fx=require('../currency-engine.js');

const fresh={base:'USD',rates:{USD:1,EUR:0.8,RUB:80},fetchedAt:'2026-08-20T12:00:00.000Z',source:'fx-rates'};

test('rate freshness status distinguishes fresh stale and unavailable books',()=>{
  const now=new Date('2026-08-20T20:00:00.000Z').getTime();
  assert.deepEqual(fx.rateBookStatus(fresh,{now}),{
    available:true,fresh:true,stale:false,ageMs:8*60*60*1000,fetchedAt:fresh.fetchedAt,source:'fx-rates'
  });
  const stale=fx.rateBookStatus(fresh,{now:new Date('2026-08-22T12:00:00.000Z').getTime()});
  assert.equal(stale.available,true);
  assert.equal(stale.fresh,false);
  assert.equal(stale.stale,true);
  assert.equal(stale.source,'fx-rates');
  assert.deepEqual(fx.rateBookStatus(null,{now}),{
    available:false,fresh:false,stale:false,ageMs:Infinity,fetchedAt:null,source:null
  });
});

test('production loader uses the consolidated currency display layer after currency runtime',()=>{
  const index=fs.readFileSync('index.html','utf8');
  const runtime=index.indexOf('./currency-runtime.js');
  const display=index.indexOf('./currency-display.js');
  assert.ok(runtime>=0);
  assert.ok(display>runtime);
  assert.equal(index.includes('./currency-freshness-ui.js'),false);
  assert.equal(fs.existsSync('currency-freshness-ui.js'),false);
});

test('consolidated currency UI exposes source age snapshot warning and explicit refresh action',()=>{
  const source=fs.readFileSync('currency-display.js','utf8');
  assert.match(source,/ARISE_FX_FRESHNESS_UI/);
  assert.match(source,/arise-fx-stale/);
  assert.match(source,/Сумма будет сохранена с этим FX snapshot/);
  assert.match(source,/data-refresh-stale-fx/);
  assert.match(source,/refreshRates\(true\)/);
});

test('backdated foreign-currency operations disclose the snapshot policy for income and expense flows',()=>{
  const source=fs.readFileSync('currency-display.js','utf8');
  assert.match(source,/arise-fx-backdated/);
  assert.match(source,/Операция записывается задним числом/);
  assert.match(source,/Исторический курс за выбранную дату автоматически не подставляется/);
  assert.match(source,/incomeDate/);
  assert.match(source,/expenseDate/);
  assert.match(source,/isBackdated/);
});

test('historical FX policy is documented as immutable snapshot-at-entry rather than fabricated historical lookup',()=>{
  const policy=fs.readFileSync('docs/FX_POLICY.md','utf8');
  assert.match(policy,/backdated/i);
  assert.match(policy,/immutable/i);
  assert.match(policy,/must not silently replace/i);
  assert.match(policy,/import/i);
});
