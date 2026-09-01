const test=require('node:test');
const assert=require('node:assert/strict');
const analytics=require('../analytics-engine.js');

function profile(){
  return {
    settings:{currency:'RUB',reserve:{enabled:true,target:120000}},
    categories:[{id:'food',name:'Жизнь'}],goals:[],
    transactions:[
      {id:'i1',type:'income',date:'2026-07-05',month:'2026-07',amount:100000,currency:'RUB',source:'Работа',allocations:[],goalAllocations:[],reserve:10000,remainder:90000},
      {id:'e1',type:'expense',date:'2026-07-10',month:'2026-07',amount:20000,currency:'RUB',categoryId:null,categoryName:'Не распределено',controlledAmount:20000,uncontrolledAmount:0},
      {id:'i2',type:'income',date:'2026-08-05',month:'2026-08',amount:150000,currency:'RUB',source:'Работа',allocations:[{categoryId:'food',name:'Жизнь',amount:30000}],goalAllocations:[],reserve:15000,remainder:105000},
      {id:'i3',type:'income',date:'2026-08-12',month:'2026-08',amount:50000,currency:'RUB',source:'Фриланс',allocations:[],goalAllocations:[],reserve:0,remainder:50000},
      {id:'e2',type:'expense',date:'2026-08-13',month:'2026-08',amount:40000,currency:'RUB',categoryId:'food',categoryName:'Жизнь',controlledAmount:40000,uncontrolledAmount:0,fundingBreakdown:{category:30000,unallocated:10000,uncontrolled:0}}
    ]
  };
}

test('monthly analytics are derived from ledger stats and transactions',()=>{
  const row=analytics.monthly(profile(),'2026-08');
  assert.equal(row.income,200000);
  assert.equal(row.expenses,40000);
  assert.equal(row.incomeCount,2);
  assert.equal(row.expenseCount,1);
  assert.equal(row.incomeSources['Работа'],150000);
  assert.equal(row.incomeSources['Фриланс'],50000);
});

test('month comparison exposes absolute and percentage movement',()=>{
  const result=analytics.compare(profile(),'2026-08','2026-07');
  assert.equal(result.income.difference,100000);
  assert.equal(result.income.percent,100);
  assert.equal(result.expenses.difference,20000);
});

test('income source shares come from actual income transactions',()=>{
  const rows=analytics.incomeSources(profile(),{month:'2026-08'});
  assert.equal(rows[0].name,'Работа');
  assert.equal(rows[0].value,150000);
  assert.equal(rows[0].share,0.75);
  assert.equal(rows[1].share,0.25);
});

test('expense composition uses the full expense purpose even when funding is split',()=>{
  const rows=analytics.expenseComposition(profile(),{month:'2026-08'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].name,'Жизнь');
  assert.equal(rows[0].value,40000);
  assert.equal(rows[0].share,1);
  const monthly=analytics.monthly(profile(),'2026-08');
  assert.equal(monthly.categorySpent['Жизнь'],30000,'ledger category funding remains distinct');
  assert.equal(monthly.expenseGroups['Жизнь'],40000,'user spending purpose keeps the full operation amount');
});

test('month timeline includes zero-operation calendar months',()=>{
  const p={settings:{currency:'RUB',reserve:{}},categories:[],goals:[],transactions:[
    {id:'m',type:'income',date:'2026-05-10',month:'2026-05',amount:10000,allocations:[],goalAllocations:[],reserve:0,remainder:10000},
    {id:'j',type:'income',date:'2026-07-10',month:'2026-07',amount:20000,allocations:[],goalAllocations:[],reserve:0,remainder:20000}
  ]};
  assert.deepEqual(analytics.months(p,{through:'2026-07'}),['2026-05','2026-06','2026-07']);
  const june=analytics.monthly(p,'2026-06');
  assert.equal(june.operations,0);
  assert.equal(june.income,0);
  assert.equal(june.freeEnd,10000,'carried unallocated money remains visible in an empty month');
});

test('series is chronological through the current calendar month and lifetime analytics stay transaction-derived',()=>{
  const p=profile();
  const expectedMonths=analytics.months(p);
  const seriesMonths=analytics.series(p).map(row=>row.month);
  assert.deepEqual(seriesMonths,expectedMonths.slice(-12));
  assert.equal(seriesMonths[0],'2026-07','series must still begin at the first ledger month while inside the default window');
  assert.ok(seriesMonths.includes('2026-08'),'last transaction month must remain represented');
  const life=analytics.lifetime(p);
  assert.equal(life.months,expectedMonths.length,'lifetime calendar span must follow the same current-month contract');
  assert.equal(life.totalIncome,300000);
  assert.equal(life.totalExpenses,60000);
  assert.equal(life.maxIncome,150000);
  assert.equal(life.minIncome,50000);
});
