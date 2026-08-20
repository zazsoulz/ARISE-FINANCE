const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('analytics-reserve-runway.js','utf8');

function boot(){
  let receivedCategoryIds=[];
  const context={
    globalThis:null,
    ARISE_FINANCE_CORE:{reserveBalance:()=>120000},
    ARISE_RESERVE_ANALYTICS:{
      reserveRunway:({reserveBalance,monthlyEssentialSpend})=>monthlyEssentialSpend>0
        ?{status:'ok',reserveBalance,monthlyEssentialSpend,months:reserveBalance/monthlyEssentialSpend}
        :{status:'insufficient_data',reserveBalance,monthlyEssentialSpend:0,months:null},
      reserveProgress:({reserveBalance,targetBalance})=>({percent:targetBalance>0?reserveBalance/targetBalance*100:0})
    },
    ARISE_RESERVE_ESSENTIAL_SPEND:{
      normalizeIds:ids=>[...new Set((ids||[]).map(String))],
      averageEssentialSpend:(_profile,{categoryIds})=>{
        receivedCategoryIds=categoryIds;
        return categoryIds.length
          ?{status:'ok',monthlyAverage:30000,includedTransactionCount:2}
          :{status:'no_categories',monthlyAverage:0,includedTransactionCount:0};
      }
    },
    renderAnalytics:()=>{},
    activeProfile:()=>({settings:{reserve:{}}}),
    document:{querySelectorAll:()=>[]},
    money:value=>`${value}`
  };
  context.globalThis=context;
  vm.createContext(context);
  new vm.Script(source,{filename:'analytics-reserve-runway.js'}).runInContext(context);
  return {context,getReceivedCategoryIds:()=>receivedCategoryIds};
}

test('analytics runway uses explicit essential categories instead of all expenses',()=>{
  const {context,getReceivedCategoryIds}=boot();
  const profile={settings:{reserve:{essentialCategoryIds:['rent','food']}},transactions:[{type:'expense',categoryId:'fun',amount:999999}]};
  const model=context.ARISE_ANALYTICS_RESERVE_RUNWAY.runwayModel(profile);
  assert.deepEqual([...getReceivedCategoryIds()],['rent','food']);
  assert.equal(model.source,'essential_categories');
  assert.equal(model.monthlyEssentialSpend,30000);
  assert.equal(model.months,4);
});

test('manual essential spend remains the highest-priority runway input',()=>{
  const {context}=boot();
  const profile={settings:{reserve:{monthlyEssentialSpend:60000,essentialCategoryIds:['rent']}}};
  const model=context.ARISE_ANALYTICS_RESERVE_RUNWAY.runwayModel(profile);
  assert.equal(model.source,'configured');
  assert.equal(model.monthlyEssentialSpend,60000);
  assert.equal(model.months,2);
});

test('analytics reserve target reads the canonical targetBalance setting',()=>{
  const {context}=boot();
  assert.equal(context.ARISE_ANALYTICS_RESERVE_RUNWAY.reserveTarget({settings:{reserve:{targetBalance:300000}}}),300000);
});

test('module parses as standalone browser JavaScript',()=>{
  assert.doesNotThrow(()=>new Function(source));
});
