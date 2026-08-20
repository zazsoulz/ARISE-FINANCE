const test=require('node:test');
const assert=require('node:assert/strict');

const fx=require('../currency-engine.js');

const book={base:'USD',rates:{USD:1,EUR:0.8,RUB:80},fetchedAt:'2026-08-20T00:00:00.000Z',source:'test'};

test('currency engine only accepts RUB EUR USD',()=>{
  assert.deepEqual([...fx.CURRENCIES],['RUB','EUR','USD']);
  assert.equal(fx.normalizeCurrency('eur'),'EUR');
  assert.equal(fx.normalizeCurrency('GBP','USD'),'USD');
});

test('cross conversion uses one coherent USD rate book',()=>{
  assert.equal(fx.rate(book,'EUR','RUB'),100);
  assert.equal(fx.convert(1000,'EUR','RUB',book),100000);
  assert.equal(fx.convert(80000,'RUB','USD',book),1000);
});

test('transaction snapshot preserves original amount and stores exact base conversion metadata',()=>{
  const snap=fx.snapshot(1000,'EUR','RUB',book);
  assert.equal(snap.originalAmount,1000);
  assert.equal(snap.originalCurrency,'EUR');
  assert.equal(snap.baseCurrency,'RUB');
  assert.equal(snap.exchangeRateToBase,100);
  assert.equal(snap.baseAmount,100000);
  assert.equal(snap.fxSource,'test');
  assert.equal(snap.fxFetchedAt,'2026-08-20T00:00:00.000Z');
  assert.equal(snap.conversionPending,false);
});

test('same-currency transaction never needs an external rate',()=>{
  const snap=fx.snapshot(50000,'RUB','RUB',null);
  assert.equal(snap.exchangeRateToBase,1);
  assert.equal(snap.baseAmount,50000);
  assert.equal(snap.conversionPending,false);
});

test('foreign transaction never invents a rate when no book exists',()=>{
  const snap=fx.snapshot(1000,'EUR','RUB',null);
  assert.equal(snap.exchangeRateToBase,null);
  assert.equal(snap.baseAmount,null);
  assert.equal(snap.conversionPending,true);
});

test('analytics can use current rate while retaining stored snapshot fallback',()=>{
  const tx={amount:1000,currency:'EUR',baseAmount:95000,baseCurrency:'RUB'};
  assert.deepEqual(fx.transactionBaseAmount(tx,'RUB',null),{amount:95000,pending:false,source:'snapshot'});
  assert.deepEqual(fx.transactionBaseAmount(tx,'RUB',book,{preferCurrentRate:true}),{amount:100000,pending:false,source:'current'});
});
