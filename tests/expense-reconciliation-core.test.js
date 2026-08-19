const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../financial-core.js');

function profile(transactions=[]){
  return {categories:[],goals:[],settings:{reserve:{enabled:false,percent:0,limit:null}},transactions};
}

test('category overspend uses category first then unallocated balance',()=>{
  const pr=profile([
    {type:'income',date:'2026-08-01',amount:100,allocations:[{categoryId:'life',amount:20}],reserve:0,remainder:80},
    {type:'expense',date:'2026-08-02',amount:30,categoryId:'life'}
  ]);
  const stats=core.monthStats(pr,'2026-08');
  assert.equal(stats.categorySpent.life,20);
  assert.equal(stats.categoryBalances.life,0);
  assert.equal(stats.freeSpent,10);
  assert.equal(stats.free,70);
  assert.equal(stats.uncontrolled,0);
});

test('legacy category overspend follows the same ledger fallback without going negative',()=>{
  const pr=profile([
    {type:'income',date:'2026-08-01',amount:100,allocations:[{categoryId:'life',amount:20}],reserve:0,remainder:5},
    {type:'expense',date:'2026-08-02',amount:30,categoryId:'life'}
  ]);
  const stats=core.monthStats(pr,'2026-08');
  assert.equal(stats.categorySpent.life,20);
  assert.equal(stats.categoryBalances.life,0);
  assert.equal(stats.freeSpent,5);
  assert.equal(stats.uncontrolled,5);
});

test('persisted legacy uncontrolled flags cannot override the actual ledger',()=>{
  const pr=profile([
    {type:'income',date:'2026-08-01',amount:100,allocations:[{categoryId:'life',amount:20}],reserve:0,remainder:80},
    {type:'expense',date:'2026-08-02',amount:30,categoryId:'life',controlledAmount:20,uncontrolledAmount:10}
  ]);
  const stats=core.monthStats(pr,'2026-08');
  assert.equal(stats.categoryBalances.life,0);
  assert.equal(stats.freeSpent,10);
  assert.equal(stats.free,70);
  assert.equal(stats.uncontrolled,0);
});
