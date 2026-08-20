(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(root) root.ARISE_RESERVE_ESSENTIAL_SPEND=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const amount=value=>Number.isFinite(Number(value))?Math.max(0,Math.round(Number(value))):0;
  const monthOf=tx=>String(tx&&tx.month||tx&&tx.date||"").slice(0,7);
  const baseAmount=tx=>amount(tx&&tx.baseAmount!=null?tx.baseAmount:tx&&tx.amount);
  const normalizeIds=ids=>[...new Set((Array.isArray(ids)?ids:[]).filter(Boolean).map(String))];

  function transactionIsEssentialExpense(tx,categoryIds){
    const ids=new Set(normalizeIds(categoryIds));
    return !!(tx&&tx.type==="expense"&&tx.categoryId!=null&&ids.has(String(tx.categoryId)));
  }

  function deriveMonthKeys(profile,limit=3){
    const keys=[...new Set((profile&&profile.transactions||[])
      .map(monthOf)
      .filter(month=>/^\d{4}-\d{2}$/.test(month)))]
      .sort();
    return keys.slice(-Math.max(1,Math.round(Number(limit)||3)));
  }

  function averageEssentialSpend(profile,{categoryIds,monthKeys,months=3}={}){
    const ids=normalizeIds(categoryIds);
    if(!ids.length){
      return {status:"no_categories",categoryIds:ids,monthlyAverage:0,monthTotals:[],includedTransactionCount:0};
    }

    const keys=(Array.isArray(monthKeys)&&monthKeys.length?monthKeys:deriveMonthKeys(profile,months))
      .map(String)
      .filter(month=>/^\d{4}-\d{2}$/.test(month))
      .slice(-Math.max(1,Math.round(Number(months)||3)));

    if(!keys.length){
      return {status:"no_history",categoryIds:ids,monthlyAverage:0,monthTotals:[],includedTransactionCount:0};
    }

    const totals=new Map(keys.map(month=>[month,0]));
    let includedTransactionCount=0;
    for(const tx of profile&&profile.transactions||[]){
      if(!transactionIsEssentialExpense(tx,ids)) continue;
      const month=monthOf(tx);
      if(!totals.has(month)) continue;
      totals.set(month,totals.get(month)+baseAmount(tx));
      includedTransactionCount++;
    }

    const monthTotals=keys.map(month=>({month,amount:totals.get(month)||0}));
    const monthlyAverage=Math.round(monthTotals.reduce((sum,item)=>sum+item.amount,0)/monthTotals.length);
    return {
      status:includedTransactionCount?"ok":"no_history",
      categoryIds:ids,
      monthlyAverage,
      monthTotals,
      includedTransactionCount
    };
  }

  return {normalizeIds,transactionIsEssentialExpense,deriveMonthKeys,averageEssentialSpend};
});
