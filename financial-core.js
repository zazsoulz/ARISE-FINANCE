(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(root) root.ARISE_FINANCE_CORE=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const integer=v=>Number.isFinite(Number(v))?Math.round(Number(v)):0;
  const nonneg=v=>Math.max(0,integer(v));
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const monthKey=value=>{
    const d=value instanceof Date?value:new Date(value||Date.now());
    if(Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  };
  const sameMonth=(tx,key)=>String(tx.month||monthKey(tx.date))===String(key);

  function historicalRemainder(tx){
    if(Number.isFinite(Number(tx&&tx.remainder))) return nonneg(tx.remainder);
    if(!tx||tx.type!=="income") return 0;
    const amount=nonneg(tx.amount);
    const allocated=Array.isArray(tx.allocations)
      ? tx.allocations.reduce((s,a)=>s+nonneg(a.amount),0)
      : 0;
    return Math.max(0,amount-allocated-nonneg(tx.reserve));
  }

  function monthToDate(transactions,date){
    const key=monthKey(date);
    const categoryAllocated={};
    let reserve=0;
    for(const tx of Array.isArray(transactions)?transactions:[]){
      if(tx.type!=="income"||!sameMonth(tx,key)) continue;
      for(const a of Array.isArray(tx.allocations)?tx.allocations:[]){
        if(!a.categoryId) continue;
        categoryAllocated[a.categoryId]=(categoryAllocated[a.categoryId]||0)+nonneg(a.amount);
      }
      reserve+=nonneg(tx.reserve);
    }
    return {key,categoryAllocated,reserve};
  }

  function remainingLimit(limit,used){
    if(limit===null||limit===""||typeof limit==="undefined") return Infinity;
    return Math.max(0,nonneg(limit)-nonneg(used));
  }

  function deterministicCategories(categories){
    return (Array.isArray(categories)?categories:[])
      .map((c,index)=>({...c,__index:index}))
      .filter(c=>c.enabled!==false)
      .sort((a,b)=>num(b.priority)-num(a.priority)||a.__index-b.__index||String(a.id).localeCompare(String(b.id)));
  }

  function percentageTargets(pool,categories){
    const valid=categories.filter(c=>c.type==="percentage"&&integer(c.percent)>=1&&integer(c.percent)<=100);
    const rows=valid.map(c=>{
      const raw=pool*integer(c.percent)/100;
      return {category:c,raw,amount:Math.floor(raw),fraction:raw-Math.floor(raw)};
    });
    const pctSum=valid.reduce((s,c)=>s+integer(c.percent),0);
    const roundedTarget=Math.min(pool,Math.floor(pool*Math.min(100,pctSum)/100));
    let missing=Math.max(0,roundedTarget-rows.reduce((s,r)=>s+r.amount,0));
    const byFraction=[...rows].sort((a,b)=>b.fraction-a.fraction||num(b.category.priority)-num(a.category.priority)||a.category.__index-b.category.__index);
    for(let i=0;missing>0&&byFraction.length;i=(i+1)%byFraction.length){
      byFraction[i].amount++;
      missing--;
    }
    return rows;
  }

  function planIncome(profile,income,date,transactions){
    const total=nonneg(income);
    const txs=Array.isArray(transactions)?transactions:(Array.isArray(profile&&profile.transactions)?profile.transactions:[]);
    const prior=monthToDate(txs,date);
    const categories=deterministicCategories(profile&&profile.categories);
    const fixed=categories.filter(c=>c.type==="fixed");
    const percentage=categories.filter(c=>c.type==="percentage");
    const allocations=[];

    const fixedTargets=fixed.map(c=>({
      category:c,
      target:Math.min(nonneg(c.fixedAmount),remainingLimit(c.limit,prior.categoryAllocated[c.id]||0))
    }));
    const fixedRequired=fixedTargets.reduce((s,r)=>s+r.target,0);
    if(fixedRequired>total){
      return {valid:false,error:"Фиксированные расходы превышают сумму дохода.",total,allocations:[],reserve:0,remainder:total,distributed:0,date};
    }

    let available=total;
    for(const row of fixedTargets){
      if(row.target<=0) continue;
      allocations.push({categoryId:row.category.id,name:row.category.name,amount:row.target,percent:0,fixed:true});
      available-=row.target;
    }

    const pctTargets=percentageTargets(available,percentage);
    pctTargets.sort((a,b)=>num(b.category.priority)-num(a.category.priority)||a.category.__index-b.category.__index);
    for(const row of pctTargets){
      const used=prior.categoryAllocated[row.category.id]||0;
      const cap=remainingLimit(row.category.limit,used);
      const wanted=Math.min(nonneg(row.amount),cap);
      const amount=Math.min(available,wanted);
      if(amount>0){
        allocations.push({categoryId:row.category.id,name:row.category.name,amount,percent:integer(row.category.percent),fixed:false});
        available-=amount;
      }
    }

    let reserve=0;
    const r=profile&&profile.settings&&profile.settings.reserve;
    if(r&&r.enabled&&available>0){
      const target=Math.floor(total*Math.max(0,num(r.percent))/100);
      const cap=remainingLimit(r.limit,prior.reserve);
      reserve=Math.min(available,target,cap);
      available-=reserve;
    }

    const remainder=available;
    const distributed=allocations.reduce((s,a)=>s+a.amount,0)+reserve;
    return {valid:true,total,allocations,reserve,remainder,distributed,date,month:prior.key};
  }

  function validatePlan(plan){
    const total=nonneg(plan&&plan.total);
    const allocated=(Array.isArray(plan&&plan.allocations)?plan.allocations:[]).reduce((s,a)=>s+nonneg(a.amount),0);
    const reserve=nonneg(plan&&plan.reserve);
    const difference=total-allocated-reserve;
    return {
      valid:difference>=0,
      total,
      distributed:allocated+reserve,
      difference,
      remainder:Math.max(0,difference),
      error:difference<0?`План превышает доход на ${Math.abs(difference)}.`:""
    };
  }

  function createIncomeTransaction(data){
    const check=validatePlan(data);
    if(!check.valid) throw new Error(check.error||"План распределения превышает доход.");
    return {
      id:data.id,
      type:"income",
      date:data.date,
      month:data.month||monthKey(data.date),
      amount:nonneg(data.total),
      currency:data.currency,
      source:data.source||"",
      note:data.note||"",
      allocations:(Array.isArray(data.allocations)?data.allocations:[]).map(a=>({...a,amount:nonneg(a.amount)})),
      reserve:nonneg(data.reserve),
      remainder:check.remainder
    };
  }

  function monthStats(profile,key){
    const txs=(Array.isArray(profile&&profile.transactions)?profile.transactions:[]).filter(tx=>sameMonth(tx,key));
    const categoryAllocated={};
    const categorySpent={};
    let income=0,reserve=0,expenses=0,freeGenerated=0,freeSpent=0,uncontrolled=0;
    for(const tx of txs){
      if(tx.type==="income"){
        income+=nonneg(tx.amount);
        reserve+=nonneg(tx.reserve);
        freeGenerated+=historicalRemainder(tx);
        for(const a of Array.isArray(tx.allocations)?tx.allocations:[]){
          if(!a.categoryId) continue;
          categoryAllocated[a.categoryId]=(categoryAllocated[a.categoryId]||0)+nonneg(a.amount);
        }
      }else if(tx.type==="expense"){
        const amount=nonneg(tx.amount);
        expenses+=amount;
        if(tx.categoryId){
          categorySpent[tx.categoryId]=(categorySpent[tx.categoryId]||0)+amount;
        }else{
          const available=Math.max(0,freeGenerated-freeSpent);
          const controlled=Math.min(amount,available);
          freeSpent+=controlled;
          uncontrolled+=amount-controlled;
        }
      }
    }
    const categoryBalances={};
    const ids=new Set([...Object.keys(categoryAllocated),...Object.keys(categorySpent)]);
    for(const id of ids) categoryBalances[id]=(categoryAllocated[id]||0)-(categorySpent[id]||0);
    return {
      month:key,
      income,
      expenses,
      reserve,
      categoryAllocated,
      categorySpent,
      categoryBalances,
      freeGenerated,
      freeSpent,
      free:Math.max(0,freeGenerated-freeSpent),
      uncontrolled,
      operationCount:txs.length
    };
  }

  return {integer,monthKey,historicalRemainder,monthToDate,planIncome,validatePlan,createIncomeTransaction,monthStats};
});