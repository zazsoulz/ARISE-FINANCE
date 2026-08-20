const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../financial-core.js');

test('monthly analytics aggregate base ledger amounts while original currency metadata is preserved',()=>{
  const profile={
    settings:{currency:'RUB',reserve:{enabled:false}},categories:[],goals:[],
    transactions:[
      {id:'i1',type:'income',date:'2026-08-20',month:'2026-08',amount:100000,currency:'RUB',originalAmount:1000,originalCurrency:'EUR',baseAmount:100000,baseCurrency:'RUB',exchangeRateToBase:100,allocations:[],goalAllocations:[],reserve:0,remainder:100000},
      {id:'e1',type:'expense',date:'2026-08-20',month:'2026-08',amount:8000,currency:'RUB',originalAmount:100,originalCurrency:'USD',baseAmount:8000,baseCurrency:'RUB',exchangeRateToBase:80,controlledAmount:8000,uncontrolledAmount:0,categoryId:null}
    ]
  };
  const stats=core.monthStats(profile,'2026-08');
  assert.equal(stats.income,100000);
  assert.equal(stats.expenses,8000);
  assert.equal(stats.free,92000);
  assert.equal(profile.transactions[0].originalAmount,1000);
  assert.equal(profile.transactions[0].originalCurrency,'EUR');
  assert.equal(profile.transactions[1].originalAmount,100);
  assert.equal(profile.transactions[1].originalCurrency,'USD');
});
