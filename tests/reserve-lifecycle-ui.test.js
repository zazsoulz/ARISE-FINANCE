const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot({configured=0,essentialCategoryIds=['rent']}={}){
  const profile={
    settings:{currency:'RUB',reserve:{monthlyEssentialSpend:configured,targetBalance:300000,essentialCategoryIds}},
    categories:[{id:'rent',name:'Жильё'},{id:'fun',name:'Развлечения'}],
    transactions:[
      {id:'e1',type:'expense',month:'2026-06',amount:40000,categoryId:'rent'},
      {id:'e2',type:'expense',month:'2026-06',amount:20000,categoryId:'fun'},
      {id:'e3',type:'expense',month:'2026-07',amount:50000,categoryId:'rent'},
      {id:'e4',type:'expense',month:'2026-08',amount:60000,categoryId:'rent'},
      {id:'e5',type:'expense',month:'2026-08',amount:30000,categoryId:'fun'}
    ]
  };
  const months=['2026-06','2026-07','2026-08'];
  const core={
    reserveBalance:()=>150000,
    availableFree:()=>25000,
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
    document:{getElementById:()=>null,querySelectorAll:()=>[]},saveState:()=>{},toast:()=>{},render:()=>{},openModal:()=>{},closeModal:()=>{},uid:()=> 'id-1',activeMonth:'2026-08'
  };
  ctx.globalThis=ctx;ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('reserve-essential-spend.js','utf8'),ctx,{filename:'reserve-essential-spend.js'});
  vm.runInContext(fs.readFileSync('reserve-lifecycle-ui.js','utf8'),ctx,{filename:'reserve-lifecycle-ui.js'});
  return {ctx,profile};
}

test('configured monthly essential spend takes priority over category history',()=>{
  const {ctx}=boot({configured:70000});
  const model=ctx.ARISE_RESERVE_LIFECYCLE.runwayModel(ctx.activeProfile());
  assert.equal(model.source,'configured');
  assert.equal(model.monthlyEssentialSpend,70000);
  assert.equal(model.categoryEstimate,50000);
  assert.ok(Math.abs(model.months-(150000/70000))<1e-9);
});

test('runway uses only explicitly selected essential categories when manual amount is empty',()=>{
  const {ctx}=boot({configured:0,essentialCategoryIds:['rent']});
  const model=ctx.ARISE_RESERVE_LIFECYCLE.runwayModel(ctx.activeProfile());
  assert.equal(model.source,'essential_categories');
  assert.equal(model.monthlyEssentialSpend,50000);
  assert.equal(model.categoryEstimate,50000);
  assert.equal(model.months,3);
});

test('runway never falls back to every expense when essential categories are not selected',()=>{
  const {ctx}=boot({configured:0,essentialCategoryIds:[]});
  const model=ctx.ARISE_RESERVE_LIFECYCLE.runwayModel(ctx.activeProfile());
  assert.equal(model.source,'none');
  assert.equal(model.monthlyEssentialSpend,0);
  assert.equal(model.status,'insufficient_data');
  assert.equal(model.months,null);
});

test('reserve section explains user-controlled essential expense model',()=>{
  const {ctx}=boot({configured:0,essentialCategoryIds:[]});
  const html=ctx.ARISE_RESERVE_LIFECYCLE.reserveSection(ctx.activeProfile());
  assert.match(html,/Категории обязательных расходов/);
  assert.match(html,/ARISE не считает все расходы обязательными автоматически/);
  assert.match(html,/reserve-essential-category/);
});
