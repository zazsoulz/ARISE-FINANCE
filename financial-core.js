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
  const txMonth=tx=>String(tx&&tx.month||monthKey(tx&&tx.date));

  function historicalRemainder(tx){
    if(Number.isFinite(Number(tx&&tx.remainder))) return nonneg(tx.remainder);
    if(!tx||tx.type!=="income") return 0;
    const amount=nonneg(tx.amount);
    const categories=asArray(tx.allocations).reduce((s,a)=>s+nonneg(a.amount),0);
    const goals=asArray(tx.goalAllocations).reduce((s,a)=>s+nonneg(a.amount),0);
    return Math.max(0,amount-categories-goals-nonneg(tx.reserve));
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
      .filter(c=>c.enabled!==false);
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
      }else if(tx.type==="goal_contribution"&&String(tx.goalId)===String(goalId)) delta+=nonneg(tx.amount);
      else if(tx.type==="goal_withdrawal"&&String(tx.goalId)===String(goalId)) delta-=nonneg(tx.amount);
    }
    return delta;
  }

  function goalBalance(profile,goalOrId){
    const goal=typeof goalOrId==="object"?goalOrId:asArray(profile&&profile.goals).find(g=>String(g.id)===String(goalOrId));
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

  function goalDeadlineStatus(profile,goal,date,plannedMonthly){
    const remaining=goalRemaining(profile,goal);
    const months=monthsUntil(goal&&goal.deadline,date);
    const required=Number.isFinite(months)&&remaining>0?Math.ceil(remaining/months):0;
    const planned=nonneg(typeof plannedMonthly==="undefined"?goal&&goal.monthlyContribution:plannedMonthly);
    return {
      remaining,
      months,
      requiredMonthly:required,
      plannedMonthly:planned,
      shortfall:Math.max(0,required-planned),
      onTrack:!Number.isFinite(months)||remaining===0||planned>=required
    };
  }

  function allocationCandidates(profile,total,date,prior){
    const rows=[];
    const categories=deterministicCategories(profile&&profile.categories);

    for(const c of categories){
      const used=nonneg(prior.categoryAllocated[c.id]||0);
      const cap=remainingLimit(c.limit,used);
      let desired=0;
      if(c.type==="fixed"){
        desired=Math.max(0,nonneg(c.fixedAmount)-used);
      }else if(c.type==="percentage"&&integer(c.percent)>=1&&integer(c.percent)<=100){
        // Percentage rules are intentionally applied to every income transaction.
        desired=Math.floor(total*integer(c.percent)/100);
      }else continue;
      desired=Math.min(desired,cap);
      if(desired>0) rows.push({kind:"category",priority:num(c.priority),order:c.__index,desired,category:c});
    }

    const reserve=profile&&profile.settings&&profile.settings.reserve;
    if(reserve&&reserve.enabled){
      const cap=remainingLimit(reserve.limit,prior.reserve);
      const desired=Math.min(Math.floor(total*Math.max(0,num(reserve.percent))/100),cap);
      if(desired>0) rows.push({kind:"reserve",priority:num(reserve.priority??3),order:10000,desired});
    }

    asArray(profile&&profile.goals).forEach((goal,index)=>{
      if(!goal||goal.status==="completed"||goal.autoAllocate===false) return;
      const remaining=goalRemaining(profile,goal);
      if(remaining<=0) return;
      const monthlyNeed=goalMonthlyNeed(profile,goal,date);
      const used=nonneg(prior.goalAllocated[goal.id]||0);
      const desired=Math.max(0,Math.min(remaining,monthlyNeed-used));
      if(desired<=0) return;
      rows.push({
        kind:"goal",
        priority:num(goal.priority),
        order:20000+index,
        desired,
        goal,
        deadlineMonths:monthsUntil(goal.deadline,date)
      });
    });

    return rows.sort((a,b)=>
      b.priority-a.priority||
      ((a.kind==="goal"?a.deadlineMonths:Infinity)-(b.kind==="goal"?b.deadlineMonths:Infinity))||
      a.order-b.order
    );
  }

  function planIncome(profile,income,date,transactions){
    const total=nonneg(income);
    const txs=Array.isArray(transactions)?transactions:asArray(profile&&profile.transactions);
    const prior=monthToDate(txs,date);
    const allocations=[];
    const goalAllocations=[];
    let reserve=0;
    let available=total;

    for(const row of allocationCandidates(profile,total,date,prior)){
      if(available<=0) break;
      const amount=Math.min(available,nonneg(row.desired));
      if(amount<=0) continue;
      if(row.kind==="category"){
        allocations.push({
          categoryId:row.category.id,
          name:row.category.name,
          amount,
          percent:row.category.type==="percentage"?integer(row.category.percent):0,
          fixed:row.category.type==="fixed"
        });
      }else if(row.kind==="reserve") reserve+=amount;
      else if(row.kind==="goal"){
        goalAllocations.push({goalId:row.goal.id,name:row.goal.name||"Цель",amount,priority:integer(row.goal.priority||3),deadline:row.goal.deadline||""});
      }
      available-=amount;
    }

    const remainder=available;
    const distributed=total-remainder;
    return {valid:true,total,allocations,goalAllocations,reserve,remainder,distributed,date,month:prior.key};
  }

  function validatePlan(plan){
    const total=nonneg(plan&&plan.total);
    const allocated=asArray(plan&&plan.allocations).reduce((s,a)=>s+nonneg(a.amount),0);
    const goals=asArray(plan&&plan.goalAllocations).reduce((s,a)=>s+nonneg(a.amount),0);
    const reserve=nonneg(plan&&plan.reserve);
    const difference=total-allocated-goals-reserve;
    return {valid:difference>=0,total,distributed:allocated+goals+reserve,difference,remainder:Math.max(0,difference),error:difference<0?`План превышает доход на ${Math.abs(difference)}.`:""};
  }

  function createIncomeTransaction(data){
    const check=validatePlan(data);
    if(!check.valid) throw new Error(check.error||"План распределения превышает доход.");
    return {
      id:data.id,type:"income",date:data.date,month:data.month||monthKey(data.date),amount:nonneg(data.total),currency:data.currency,
      source:data.source||"",note:data.note||"",
      allocations:asArray(data.allocations).map(a=>({...a,amount:nonneg(a.amount)})),
      goalAllocations:asArray(data.goalAllocations).map(a=>({...a,amount:nonneg(a.amount)})),
      reserve:nonneg(data.reserve),remainder:check.remainder
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

  function replayLedger(profile,throughMonth,selectedMonth){
    const categoryBalances={};
    let free=0;
    const selected={income:0,expenses:0,reserve:0,reserveWithdrawn:0,categoryAllocated:{},categorySpent:{},goalAllocated:{},goalFundedFromFree:0,freeGenerated:0,freeSpent:0,uncontrolled:0,operationCount:0};
    const txs=asArray(profile&&profile.transactions)
      .filter(tx=>!throughMonth||txMonth(tx)<=throughMonth)
      .map((tx,index)=>({tx,index}))
      .sort((a,b)=>String(a.tx.date||"").localeCompare(String(b.tx.date||""))||a.index-b.index);

    for(const {tx} of txs){
      const inSelected=txMonth(tx)===selectedMonth;
      if(inSelected) selected.operationCount++;

      if(tx.type==="income"){
        if(inSelected){selected.income+=nonneg(tx.amount);selected.reserve+=nonneg(tx.reserve);selected.freeGenerated+=historicalRemainder(tx);}
        for(const a of asArray(tx.allocations)){
          if(!a.categoryId) continue;
          categoryBalances[a.categoryId]=(categoryBalances[a.categoryId]||0)+nonneg(a.amount);
          if(inSelected) selected.categoryAllocated[a.categoryId]=(selected.categoryAllocated[a.categoryId]||0)+nonneg(a.amount);
        }
        for(const a of asArray(tx.goalAllocations)){
          if(inSelected&&a.goalId) selected.goalAllocated[a.goalId]=(selected.goalAllocated[a.goalId]||0)+nonneg(a.amount);
        }
        free+=historicalRemainder(tx);
        continue;
      }

      if(tx.type==="expense"){
        const amount=nonneg(tx.amount);
        if(inSelected) selected.expenses+=amount;
        let left=amount;
        if(tx.categoryId){
          const fromCategory=Math.min(left,Math.max(0,categoryBalances[tx.categoryId]||0));
          categoryBalances[tx.categoryId]=(categoryBalances[tx.categoryId]||0)-fromCategory;
          left-=fromCategory;
          if(inSelected) selected.categorySpent[tx.categoryId]=(selected.categorySpent[tx.categoryId]||0)+fromCategory;
        }
        const fromFree=Math.min(left,free);
        free-=fromFree;
        left-=fromFree;
        if(inSelected){selected.freeSpent+=fromFree;selected.uncontrolled+=left;}
        continue;
      }

      if(tx.type==="goal_contribution"){
        const amount=nonneg(tx.amount);
        if(inSelected&&tx.goalId) selected.goalAllocated[tx.goalId]=(selected.goalAllocated[tx.goalId]||0)+amount;
        if(tx.sourceAccount==="reserve"){
          if(inSelected) selected.reserveWithdrawn+=amount;
        }else if(!tx.sourceAccount||tx.sourceAccount==="free"||tx.sourceAccount==="unallocated"){
          const fromFree=Math.min(amount,free);
          free-=fromFree;
          if(inSelected){selected.freeSpent+=fromFree;selected.goalFundedFromFree+=fromFree;selected.uncontrolled+=amount-fromFree;}
        }
        continue;
      }

      if(tx.type==="reserve_withdrawal"&&inSelected) selected.reserveWithdrawn+=nonneg(tx.amount);
    }
    return {free:Math.max(0,free),categoryBalances,selected};
  }

  function monthStats(profile,key){
    const {free,categoryBalances,selected}=replayLedger(profile,key,key);
    return {month:key,...selected,categoryBalances,free};
  }

  function availableFree(profile,date){
    return replayLedger(profile,monthKey(date),monthKey(date)).free;
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
    if((sourceAccount==="free"||sourceAccount==="unallocated")&&amount>availableFree(profile,data.date)) throw new Error("Недостаточно нераспределённых денег для пополнения цели.");
    if(sourceAccount==="reserve"&&amount>reserveBalance(profile)) throw new Error("Недостаточно денег в резерве.");
    return {id:data.id,type:"goal_contribution",goalId:goal.id,goalName:goal.name||"Цель",amount,sourceAccount,date:data.date,month:data.month||monthKey(data.date),currency:data.currency,note:data.note||""};
  }

  function createReserveWithdrawal(profile,data){
    const amount=nonneg(data&&data.amount);
    if(amount<=0) throw new Error("Сумма должна быть больше нуля.");
    if(amount>reserveBalance(profile)) throw new Error("Недостаточно денег в резерве.");
    return {id:data.id,type:"reserve_withdrawal",amount,date:data.date,month:data.month||monthKey(data.date),currency:data.currency,source:data.source||"",note:data.note||""};
  }

  function goalProjection(profile,goal,date){
    const balance=goalBalance(profile,goal);
    const remaining=Math.max(0,nonneg(goal&&goal.target)-balance);
    const monthly=goalMonthlyNeed(profile,goal,date);
    const months=remaining<=0?0:(monthly>0?Math.ceil(remaining/monthly):Infinity);
    return {balance,remaining,monthlyNeed:monthly,months,deadline:goalDeadlineStatus(profile,goal,date)};
  }

  return {
    integer,monthKey,historicalRemainder,monthToDate,planIncome,simulateIncome:planIncome,validatePlan,createIncomeTransaction,
    monthStats,availableFree,reserveBalance,goalBalance,goalRemaining,goalMonthlyNeed,goalDeadlineStatus,goalProjection,
    createGoalContribution,createReserveWithdrawal
  };
});