const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(){
  const core={
    monthKey:value=>String(value||'').slice(0,7),
    monthStats:()=>({reserve:1000,reserveWithdrawn:500,free:10000,freeSpent:0,freeGenerated:0}),
    availableFree:()=>10000,
    reserveBalance:()=>4000
  };
  const ctx={console,ARISE_FINANCE_CORE:core,globalThis:null,window:null};ctx.globalThis=ctx;ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('reserve-lifecycle-core.js','utf8'),ctx,{filename:'reserve-lifecycle-core.js'});
  return ctx.ARISE_FINANCE_CORE;
}

const profile={transactions:[
  {id:'d1',type:'reserve_deposit',amount:2000,date:'2026-08-10',month:'2026-08',sourceAccount:'free',destinationAccount:'reserve'},
  {id:'w1',type:'reserve_withdrawal',amount:1000,date:'2026-08-15',month:'2026-08',sourceAccount:'reserve',destinationAccount:'free'}
]};

test('manual reserve transfers adjust free money without double-counting base withdrawal stats',()=>{
  const core=boot();
  const stats=core.monthStats(profile,'2026-08');
  assert.equal(stats.reserve,3000);
  assert.equal(stats.reserveWithdrawn,500);
  assert.equal(stats.free,9000);
  assert.equal(stats.freeSpent,2000);
  assert.equal(stats.freeGenerated,1000);
  assert.equal(core.availableFree(profile,'2026-08-20'),9000);
});

test('reserve deposit is limited by currently unallocated money',()=>{
  const core=boot();
  assert.throws(()=>core.createReserveDeposit(profile,{id:'d2',amount:9001,date:'2026-08-20',currency:'RUB'}),/Недостаточно нераспределённых/);
  const tx=core.createReserveDeposit(profile,{id:'d2',amount:9000,date:'2026-08-20',currency:'RUB'});
  assert.equal(tx.type,'reserve_deposit');
  assert.equal(tx.sourceAccount,'free');
  assert.equal(tx.destinationAccount,'reserve');
});

test('reserve withdrawal is limited by reserve balance and returns to unallocated money',()=>{
  const core=boot();
  assert.throws(()=>core.createReserveWithdrawal(profile,{id:'w2',amount:4001,date:'2026-08-20',currency:'RUB'}),/Недостаточно денег в резерве/);
  const tx=core.createReserveWithdrawal(profile,{id:'w2',amount:4000,date:'2026-08-20',currency:'RUB'});
  assert.equal(tx.type,'reserve_withdrawal');
  assert.equal(tx.sourceAccount,'reserve');
  assert.equal(tx.destinationAccount,'free');
});
