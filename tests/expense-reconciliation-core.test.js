const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../financial-core.js');

function profile(transactions=[]){
  return {
    categories:[],
    goals:[],
    settings:{reserve:{enabled:false,percent:0,limit:null}},
    transactions
  };
}

test('category overspend consumes only available category balance and records excess as uncontrolled',()=>{
  const pr=profile([
    {
      type:'income',date:'2026-08-01',amount:100,
      allocations:[{categoryId:'life',amount:20}],reserve:0,remainder:80
    },
    {
      type:'expense',date:'2026-08-02',amount:30,categoryId:'life',
      fundingSource:'category',fundingSourceId:'life',
      controlledAmount:20,uncontrolledAmount:10
    }
  ]);

  const stats=core.monthStats(pr,'2026-08');
  assert.equal(stats.categorySpent.life,20);
  assert.equal(stats.categoryBalances.life,0);
  assert.equal(stats.uncontrolled,10);
  assert.equal(stats.free,80);
});

test('legacy category overspend is reconciled from ledger balances without going negative',()=>{
  const pr=profile([
    {
      type:'income',date:'2026-08-01',amount:100,
      allocations:[{categoryId:'life',amount:20}],reserve:0,remainder:80
    },
    {type:'expense',date:'2026-08-02',amount:30,categoryId:'life'}
  ]);

  const stats=core.monthStats(pr,'2026-08');
  assert.equal(stats.categorySpent.life,20);
  assert.equal(stats.categoryBalances.life,0);
  assert.equal(stats.uncontrolled,10);
});

test('explicit uncontrolled amount cannot hide unexplained expense value',()=>{
  const pr=profile([
    {
      type:'income',date:'2026-08-01',amount:100,
      allocations:[{categoryId:'life',amount:20}],reserve:0,remainder:80
    },
    {
      type:'expense',date:'2026-08-02',amount:30,categoryId:'life',
      controlledAmount:20,uncontrolledAmount:0
    }
  ]);

  const stats=core.monthStats(pr,'2026-08');
  assert.equal(stats.categoryBalances.life,0);
  assert.equal(stats.uncontrolled,10);
});
