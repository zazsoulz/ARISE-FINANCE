const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot({configured=0,monthlyExpenses=[40000,60000,50000]}={}){
  const profile={
    settings:{currency:'RUB',reserve:{monthlyEssentialSpend:configured,targetBalance:300000}},
    transactions:[]
  };
  const months=['2026-06','2026-07','2026-08'];
  const byMonth=new Map(months.map((month,index)=>[month,monthlyExpenses[index]||0]));
  const core={
    reserveBalance:()=>150000,
    availableFree:()=>25000,
    monthStats:(p,month)=>({expenses:byMonth.get(month)||0}),
    createReserveDeposit(){},createReserveWithdrawal(){},monthKey:value=>String(value).slice(0,7)
  };
  const analytics={
    reserveRunway({reserveBalance,monthlyEssentialSpend}){
      return monthlyEssentialSpend>0?{status:'ok',reserveBalance,monthlyEssentialSpend,months:reserveBalance/monthlyEssentialSpend}:{status:'insufficient_data',reserveBalance,monthlyEssentialSpend,months:null};
    },
    reserveProgress({reserveBalance,targetBalance}){return {status:'ok',percent:targetBalance?reserveBalance/targetBalance*100:0};}
  };
  const ctx={
    console,globalThis:null,window:null,ARISE_FINANCE_CORE:core,ARISE_RESERVE_ANALYTICS:analytics,
    renderSettings:()=>{},historyTransaction:()=>'',activeProfile:()=>profile,
    allMonths:()=>months,today:()=> '2026-08-20',money:v=>`${v} ₽`,formatDate:v=>v,escapeHTML:v=>String(v??''),
    document:{getElementById:()=>null},saveState:()=>{},toast:()=>{},render:()=>{},openModal:()=>{},closeModal:()=>{},uid:()=> 'id-1',activeMonth:'2026-08'
  };
  ctx.globalThis=ctx;ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('reserve-lifecycle-ui.js','utf8'),ctx,{filename:'reserve-lifecycle-ui.js'});
  return {ctx,profile};
}

test('configured monthly essential spend takes priority over automatic expense average',()=>{
  const {ctx}=boot({configured:70000});
  const model=ctx.ARISE_RESERVE_LIFECYCLE.runwayModel(ctx.activeProfile());
  assert.equal(model.source,'configured');
  assert.equal(model.monthlyEssentialSpend,70000);
  assert.equal(model.autoEstimate,50000);
  assert.ok(Math.abs(model.months-(150000/70000))<1e-9);
});

test('runway transparently falls back to recent actual expense average when no baseline is configured',()=>{
  const {ctx}=boot({configured:0});
  const model=ctx.ARISE_RESERVE_LIFECYCLE.runwayModel(ctx.activeProfile());
  assert.equal(model.source,'average_expenses');
  assert.equal(model.monthlyEssentialSpend,50000);
  assert.equal(model.autoEstimate,50000);
  assert.equal(model.months,3);
});

test('runway reports insufficient data instead of inventing a baseline',()=>{
  const {ctx}=boot({configured:0,monthlyExpenses:[0,0,0]});
  const model=ctx.ARISE_RESERVE_LIFECYCLE.runwayModel(ctx.activeProfile());
  assert.equal(model.source,'none');
  assert.equal(model.monthlyEssentialSpend,0);
  assert.equal(model.status,'insufficient_data');
  assert.equal(model.months,null);
});
