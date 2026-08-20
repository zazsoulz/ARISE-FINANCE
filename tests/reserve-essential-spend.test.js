const test=require('node:test');
const assert=require('node:assert/strict');
const {averageEssentialSpend,transactionIsEssentialExpense}=require('../reserve-essential-spend.js');

function profile(){
  return {
    transactions:[
      {id:'e1',type:'expense',month:'2026-06',amount:30000,categoryId:'rent'},
      {id:'e2',type:'expense',month:'2026-06',amount:12000,categoryId:'fun'},
      {id:'e3',type:'expense',month:'2026-07',amount:32000,categoryId:'rent'},
      {id:'e4',type:'expense',month:'2026-07',amount:9000,baseAmount:10000,categoryId:'food'},
      {id:'e5',type:'expense',month:'2026-08',amount:34000,categoryId:'rent'},
      {id:'i1',type:'income',month:'2026-08',amount:100000,categoryId:'rent'}
    ]
  };
}

test('only explicitly selected categories count as essential spend',()=>{
  const result=averageEssentialSpend(profile(),{categoryIds:['rent'],monthKeys:['2026-06','2026-07','2026-08']});
  assert.equal(result.status,'ok');
  assert.equal(result.includedTransactionCount,3);
  assert.equal(result.monthlyAverage,32000);
  assert.deepEqual(result.monthTotals.map(item=>item.amount),[30000,32000,34000]);
});

test('essential spend uses immutable base amount when present',()=>{
  const result=averageEssentialSpend(profile(),{categoryIds:['food'],monthKeys:['2026-06','2026-07','2026-08']});
  assert.equal(result.monthlyAverage,3333);
  assert.deepEqual(result.monthTotals.map(item=>item.amount),[0,10000,0]);
});

test('no category selection never falls back to all expenses',()=>{
  const result=averageEssentialSpend(profile(),{categoryIds:[],monthKeys:['2026-06','2026-07','2026-08']});
  assert.equal(result.status,'no_categories');
  assert.equal(result.monthlyAverage,0);
  assert.equal(result.includedTransactionCount,0);
});

test('selected category with no history reports insufficient history',()=>{
  const result=averageEssentialSpend(profile(),{categoryIds:['utilities'],monthKeys:['2026-06','2026-07','2026-08']});
  assert.equal(result.status,'no_history');
  assert.equal(result.monthlyAverage,0);
});

test('income never qualifies as an essential expense',()=>{
  assert.equal(transactionIsEssentialExpense({type:'income',categoryId:'rent',amount:100},['rent']),false);
  assert.equal(transactionIsEssentialExpense({type:'expense',categoryId:'rent',amount:100},['rent']),true);
});
