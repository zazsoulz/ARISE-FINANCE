(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(root) root.ARISE_FINANCE_CORE=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const integer=v=>Number.isFinite(Number(v))?Math.round(Number(v)):0;
  const nonneg=v=>Math.max(0,integer(v));
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const asArray=v=>Array.isArray(v)?v:[];

  const monthKey=value=>{
    if(typeof value==="string"&&/^\d{4}-\d{2}/.test(value)) return value.slice(0,7);
    const d=value instanceof Date?value:new Date(value||Date.now());
    if(Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  };

  const sameMonth=(tx,key)=>String(tx&&tx.month||monthKey(tx&&tx.date))===String(key);

  function historicalRemainder(tx){
    if(Number.isFinite(Number(tx&&tx.remainder))) return nonneg(tx.remainder);
    if(!tx||tx.type!=="income") return 0;
    const amount=nonneg(tx.amount);
    const allocated=asArray(tx.allocations).reduce((s,a)=>s+nonneg(a.amount),0);
    const goals=asArray(tx.goalAllocations).reduce((s,a)=>s+nonneg(a.amount),0);
    return Math.max(0,amount-allocated-goals-nonneg(tx.reserve));
  }

  function monthToDate(transactions,date){
    const key=monthKey(date);
    const categoryAllocated={};
    const goalAllocated={};
    let reserve=0;
    for(const tx of asArray(transactions)){
      if(!sameMonth(tx,key)) continue;
      if(tx.type==="income"){
        for(const a of asArray(tx.allocations)){
          if(!a.categoryId) continue;
          categoryAllocated[a.categoryId]=(categoryAllocated[a.categoryId]||0)+nonneg(a.amount);
        }
        for(const a of asArray(tx.goalAllocations)){
          if(!a.goalId) continue;
          goalAllocated[a.goalId]=(goalAllocated[a.goalId]||0)+nonneg(a.amount);
        }
        reserve+=nonneg(tx.reserve);
      }else if(tx.type==="goal_contribution"&&tx.goalId){
        goalAllocated[tx.goalId]=(goalAllocated[tx.goalId]||0)+nonneg(tx.amount);
      }
    }
    return {key,categoryAllocated,goalAllocated,reserve};
  }

  function remainingLimit(limit,used){
    if(limit===null||limit===""||typeof limit==="undefined") return Infinity;
    return Math.max(0,nonneg(limit)-nonneg(used));
  }

  function deterministicCategories(categories){
    return asArray(categories)
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

  function goalLedgerStart(goal){
    if(Number.isFinite(Number(goal&&goal.ledgerStart))) return nonneg(goal.ledgerStart);
    return nonneg(goal&&goal.current);
  }

  function goalLedgerDelta(profile,goalId){
    let delta=0;
    for(const tx of asArray(profile&&profile.transactions)){
      if(tx.type==="income"){
        for(const a of asArray(tx.goalAllocations)){
          if(String(a.goalId)===String(goalId)) delta+=nonneg(a.amount);
        }
      }else if(tx.type==="goal_contribution"&&String(tx.goalId)===String(goalId)){
        delta+=nonneg(tx.amount);
      }else if(tx.type==="goal_withdrawal"&&String(tx.goalId)===String(goalId)){
        delta-=nonneg(tx.amount);
      }
    }
    return delta;
  }

  function goalBalance(profile,goalOrId){
    const goal=typeof goalOrId==="object"
      ? goalOrId
      : asArray(profile&&profile.goals).find(g=>String(g.id)===String(goalOrId));
    if(!goal) return 0;
    if(!Number.isFinite(Number(goal.ledgerStart))) return nonneg(goal.current);
    return Math.max(0,goalLedgerStart(goal)+goalLedgerDelta(profile,goal.id));
  }

  function goalRemaining(profile,goal){
    return Math.max(0,nonneg(goal&&goal.target)-goalBalance(profile,goal));
  }

  function monthsUntil(deadline,date){
    if(!deadline) return Infinity;
    const start=new Date(`${monthKey(date)}-01T00:00:00`);
    const end=new Date(`${String(deadline).slice(0,10)}T23:59:59`);
    if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())) return Infinity;
    if(end<start) return 1;
    return Math.max(1,(end.getFullYear()-start.getFullYear())*12+(end.getMonth()-start.getMonth())+1);
  }

  function goalMonthlyNeed(profile,goal,date){
    const remaining=goalRemaining(profile,goal);
    if(!remaining) return 0;
    const configured=nonneg(goal&&goal.monthlyContribution);
    const months=monthsUntil(goal&&goal.deadline,date);
    const deadlineNeed=Number.isFinite(months)?Math.ceil(remaining/months):0;
    return Math.min(remaining,Math.max(configured,deadlineNeed));
  }

  function activeGoalRows(profile,date,prior){
    return asArray(profile&&profile.goals)
      .map((goal,index)=>{
        const remaining=goalRemaining(profile,goal);
        const monthNeed=goalMonthlyNeed(profile,goal,date);
        const used=nonneg(prior.goalAllocated[goal.id]||0);
        return {
          goal,
          index,
          remaining,
          target:Math.max(0,Math.min(remaining,monthNeed-used)),
          deadlineMonths:monthsUntil(goal.deadline,date)
        };
      })
      .filter(row=>row.goal&&row.goal.status!=="completed"&&row.remaining>0&&row.target>0&&row.goal.autoAllocate!==false)
      .sort((a,b)=>
        num(b.goal.priority)-num(a.goal.priority)||
        a.deadlineMonths-b.deadlineMonths||
        a.remaining-b.remaining||
        a.index-b.index||
        String(a.goal.id).localeCompare(String(b.goal.id))
      );
  }

  function planIncome(profile,income,date,transactions){
    const total=nonneg(income);
    const txs=Array.isArray(transactions)?transactions:asArray(profile&&profile.transactions);
    const prior=monthToDate(txs,date);
    const categories=deterministicCategories(profile&&profile.categories);
    const fixed=categories.filter(c=>c.type==="fixed");
    const percentage=categories.filter(c=>c.type==="percentage");
    const allocations=[];
    const goalAllocations=[];

    const fixedTargets=fixed.map(c=>({
      category:c,
      target:Math.min(nonneg(c.fixedAmount),remainingLimit(c.limit,prior.categoryAllocated[c.id]||0))
    }));
    const fixedRequired=fixedTargets.reduce((s,r)=>s+r.target,0);
    if(fixedRequired>total){
      return {valid:false,error:"Фиксированные расходы превышают сумму дохода.",total,allocations:[],goalAllocations:[],reserve:0,remainder:total,distributed:0,date,month:prior.key};
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

    if(available>0){
      for(const row of activeGoalRows(profile,date,prior)){
        if(available<=0) break;
        const amount=Math.min(available,row.target);
        if(amount<=0) continue;
        goalAllocations.push({
          goalId:row.goal.id,
          name:row.goal.name||"Цель",
          amount,
          priority:integer(row.goal.priority||3),
          deadline:row.goal.deadline||""
        });
        available-=amount;
      }
    }

    const remainder=available;
    const distributed=allocations.reduce((s,a)=>s+a.amount,0)+reserve+goalAllocations.reduce((s,a)=>s+a.amount,0);
    return {valid:true,total,allocations,goalAllocations,reserve,remainder,distributed,date,month:prior.key};
  }

  function validatePlan(plan){
    const total=nonneg(plan&&plan.total);
    const allocated=asArray(plan&&plan.allocations).reduce((s,a)=>s+nonneg(a.amount),0);
    const goals=asArray(plan&&plan.goalAllocations).reduce((s,a)=>s+nonneg(a.amount),0);
    const reserve=nonneg(plan&&plan.reserve);
    const difference=total-allocated-goals-reserve;
    return {
      valid:difference>=0,
      total,
      distributed:allocated+goals+reserve,
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
      allocations:asArray(data.allocations).map(a=>({...a,amount:nonneg(a.amount)})),
      goalAllocations:asArray(data.goalAllocations).map(a=>({...a,amount:nonneg(a.amount)})),
      reserve:nonneg(data.reserve),
      remainder:check.remainder
    };
  }

  function reserveBalance(profile){
    let balance=0;
    for(const tx of asArray(profile&&profile.transactions)){
      if(tx.type==="income") balance+=nonneg(tx.reserve);
      else if(tx.type==="reserve_deposit") balance+=nonneg(tx.amount);
      else if(tx.type==="reserve_withdrawal") balance-=nonneg(tx.amount);
      else if(tx.type==="goal_contribution"&&tx.sourceAccount==="reserve") balance-=nonneg(tx.amount);
    }
    return Math.max(0,balance);
  }

  function monthStats(profile,key){
    const txs=asArray(profile&&profile.transactions).filter(tx=>sameMonth(tx,key));
    const categoryAllocated={};
    const categorySpent={};
    const goalAllocated={};
    let income=0,reserve=0,reserveWithdrawn=0,expenses=0,freeGenerated=0,freeSpent=0,uncontrolled=0,goalFundedFromFree=0;
    for(const tx of txs){
      if(tx.type==="income"){
        income+=nonneg(tx.amount);
        reserve+=nonneg(tx.reserve);
        freeGenerated+=historicalRemainder(tx);
        for(const a of asArray(tx.allocations)){
          if(!a.categoryId) continue;
          categoryAllocated[a.categoryId]=(categoryAllocated[a.categoryId]||0)+nonneg(a.amount);
        }
        for(const a of asArray(tx.goalAllocations)){
          if(!a.goalId) continue;
          goalAllocated[a.goalId]=(goalAllocated[a.goalId]||0)+nonneg(a.amount);
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
      }else if(tx.type==="goal_contribution"){
        const amount=nonneg(tx.amount);
        if(tx.goalId) goalAllocated[tx.goalId]=(goalAllocated[tx.goalId]||0)+amount;
        if(tx.sourceAccount==="reserve"){
          reserveWithdrawn+=amount;
        }else if(!tx.sourceAccount||tx.sourceAccount==="free"){
          const available=Math.max(0,freeGenerated-freeSpent);
          const controlled=Math.min(amount,available);
          freeSpent+=controlled;
          goalFundedFromFree+=controlled;
          uncontrolled+=amount-controlled;
        }
      }else if(tx.type==="reserve_withdrawal"){
        reserveWithdrawn+=nonneg(tx.amount);
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
      reserveWithdrawn,
      categoryAllocated,
      categorySpent,
      categoryBalances,
      goalAllocated,
      goalFundedFromFree,
      freeGenerated,
      freeSpent,
      free:Math.max(0,freeGenerated-freeSpent),
      uncontrolled,
      operationCount:txs.length
    };
  }

  function availableFree(profile,date){
    return monthStats(profile,monthKey(date)).free;
  }

  function createGoalContribution(profile,data){
    const goal=asArray(profile&&profile.goals).find(g=>String(g.id)===String(data&&data.goalId));
    if(!goal) throw new Error("Цель не найдена.");
    const requested=nonneg(data&&data.amount);
    if(requested<=0) throw new Error("Сумма пополнения должна быть больше нуля.");
    const remaining=goalRemaining(profile,goal);
    if(remaining<=0) throw new Error("Цель уже достигнута.");
    const amount=Math.min(requested,remaining);
    const sourceAccount=data.sourceAccount||"free";
    if(sourceAccount==="free"&&amount>availableFree(profile,data.date)){
      throw new Error("Недостаточно свободных денег для пополнения цели.");
    }
    if(sourceAccount==="reserve"&&amount>reserveBalance(profile)){
      throw new Error("Недостаточно денег в резерве.");
    }
    return {
      id:data.id,
      type:"goal_contribution",
      goalId:goal.id,
      goalName:goal.name||"Цель",
      amount,
      sourceAccount,
      date:data.date,
      month:data.month||monthKey(data.date),
      currency:data.currency,
      note:data.note||""
    };
  }

  function createReserveWithdrawal(profile,data){
    const amount=nonneg(data&&data.amount);
    if(amount<=0) throw new Error("Сумма должна быть больше нуля.");
    if(amount>reserveBalance(profile)) throw new Error("Недостаточно денег в резерве.");
    return {
      id:data.id,
      type:"reserve_withdrawal",
      amount,
      date:data.date,
      month:data.month||monthKey(data.date),
      currency:data.currency,
      source:data.source||"",
      note:data.note||""
    };
  }

  function goalProjection(profile,goal,date){
    const balance=goalBalance(profile,goal);
    const remaining=Math.max(0,nonneg(goal&&goal.target)-balance);
    const monthly=goalMonthlyNeed(profile,goal,date);
    const months=remaining<=0?0:(monthly>0?Math.ceil(remaining/monthly):Infinity);
    return {balance,remaining,monthlyNeed:monthly,months};
  }

  return {
    integer,
    monthKey,
    historicalRemainder,
    monthToDate,
    planIncome,
    simulateIncome:planIncome,
    validatePlan,
    createIncomeTransaction,
    monthStats,
    availableFree,
    reserveBalance,
    goalBalance,
    goalRemaining,
    goalMonthlyNeed,
    goalProjection,
    createGoalContribution,
    createReserveWithdrawal
  };
});
