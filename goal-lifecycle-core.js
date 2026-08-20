(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  if(!core)return;

  const baseMonthStats=core.monthStats.bind(core);
  const nonneg=value=>Math.max(0,Math.round(Number(value)||0));
  const asArray=value=>Array.isArray(value)?value:[];
  const monthKey=value=>core.monthKey(value);
  const txMonth=tx=>String(tx&&tx.month||monthKey(tx&&tx.date));

  function historicalRemainder(tx){
    if(Number.isFinite(Number(tx&&tx.remainder)))return nonneg(tx.remainder);
    if(!tx||tx.type!=="income")return 0;
    const categories=asArray(tx.allocations).reduce((sum,item)=>sum+nonneg(item.amount),0);
    const goals=asArray(tx.goalAllocations).reduce((sum,item)=>sum+nonneg(item.amount),0);
    return Math.max(0,nonneg(tx.amount)-categories-goals-nonneg(tx.reserve));
  }

  function replayLedger(profile,throughMonth,selectedMonth){
    const categoryBalances={};
    let free=0;
    const selected={income:0,expenses:0,reserve:0,reserveWithdrawn:0,categoryAllocated:{},categorySpent:{},goalAllocated:{},goalFundedFromFree:0,goalWithdrawn:0,freeGenerated:0,freeSpent:0,uncontrolled:0,operationCount:0};
    const txs=asArray(profile&&profile.transactions)
      .filter(tx=>!throughMonth||txMonth(tx)<=throughMonth)
      .map((tx,index)=>({tx,index}))
      .sort((a,b)=>String(a.tx.date||"").localeCompare(String(b.tx.date||""))||a.index-b.index);

    for(const {tx} of txs){
      const inSelected=txMonth(tx)===selectedMonth;
      if(inSelected)selected.operationCount++;

      if(tx.type==="income"){
        if(inSelected){selected.income+=nonneg(tx.amount);selected.reserve+=nonneg(tx.reserve);selected.freeGenerated+=historicalRemainder(tx);}
        for(const item of asArray(tx.allocations)){
          if(!item.categoryId)continue;
          categoryBalances[item.categoryId]=(categoryBalances[item.categoryId]||0)+nonneg(item.amount);
          if(inSelected)selected.categoryAllocated[item.categoryId]=(selected.categoryAllocated[item.categoryId]||0)+nonneg(item.amount);
        }
        for(const item of asArray(tx.goalAllocations))if(inSelected&&item.goalId)selected.goalAllocated[item.goalId]=(selected.goalAllocated[item.goalId]||0)+nonneg(item.amount);
        free+=historicalRemainder(tx);
        continue;
      }

      if(tx.type==="expense"){
        const amount=nonneg(tx.amount);
        if(inSelected)selected.expenses+=amount;
        let left=amount;
        if(tx.categoryId){
          const fromCategory=Math.min(left,Math.max(0,categoryBalances[tx.categoryId]||0));
          categoryBalances[tx.categoryId]=(categoryBalances[tx.categoryId]||0)-fromCategory;
          left-=fromCategory;
          if(inSelected)selected.categorySpent[tx.categoryId]=(selected.categorySpent[tx.categoryId]||0)+fromCategory;
        }
        const fromFree=Math.min(left,free);
        free-=fromFree;left-=fromFree;
        if(inSelected){selected.freeSpent+=fromFree;selected.uncontrolled+=left;}
        continue;
      }

      if(tx.type==="goal_contribution"){
        const amount=nonneg(tx.amount);
        if(inSelected&&tx.goalId)selected.goalAllocated[tx.goalId]=(selected.goalAllocated[tx.goalId]||0)+amount;
        if(tx.sourceAccount==="reserve"){
          if(inSelected)selected.reserveWithdrawn+=amount;
        }else if(!tx.sourceAccount||tx.sourceAccount==="free"||tx.sourceAccount==="unallocated"){
          const fromFree=Math.min(amount,free);
          free-=fromFree;
          if(inSelected){selected.freeSpent+=fromFree;selected.goalFundedFromFree+=fromFree;selected.uncontrolled+=amount-fromFree;}
        }
        continue;
      }

      if(tx.type==="goal_withdrawal"){
        const amount=nonneg(tx.amount);
        if(inSelected)selected.goalWithdrawn+=amount;
        if(tx.destinationAccount==="reserve"){
          if(inSelected)selected.reserve+=amount;
        }else if(!tx.destinationAccount||tx.destinationAccount==="free"||tx.destinationAccount==="unallocated"){
          free+=amount;
          if(inSelected)selected.freeGenerated+=amount;
        }
        continue;
      }

      if(tx.type==="reserve_withdrawal"&&inSelected)selected.reserveWithdrawn+=nonneg(tx.amount);
    }
    return {free:Math.max(0,free),categoryBalances,selected};
  }

  function monthStats(profile,key){
    const {free,categoryBalances,selected}=replayLedger(profile,key,key);
    return {month:key,...selected,categoryBalances,free};
  }

  function availableFree(profile,date){
    const key=monthKey(date);
    return replayLedger(profile,key,key).free;
  }

  function reserveBalance(profile){
    let balance=0;
    for(const tx of asArray(profile&&profile.transactions)){
      if(tx.type==="income")balance+=nonneg(tx.reserve);
      else if(tx.type==="reserve_deposit")balance+=nonneg(tx.amount);
      else if(tx.type==="reserve_withdrawal")balance-=nonneg(tx.amount);
      else if(tx.type==="goal_contribution"&&tx.sourceAccount==="reserve")balance-=nonneg(tx.amount);
      else if(tx.type==="goal_withdrawal"&&tx.destinationAccount==="reserve")balance+=nonneg(tx.amount);
    }
    return Math.max(0,balance);
  }

  function goalById(profile,id){return asArray(profile&&profile.goals).find(goal=>String(goal.id)===String(id));}

  function createGoalContribution(profile,data){
    const goal=goalById(profile,data&&data.goalId);
    if(!goal)throw new Error("Цель не найдена.");
    const requested=nonneg(data&&data.amount);
    if(requested<=0)throw new Error("Сумма пополнения должна быть больше нуля.");
    const remaining=core.goalRemaining(profile,goal);
    if(remaining<=0)throw new Error("Цель уже достигнута.");
    const amount=Math.min(requested,remaining);
    const sourceAccount=data.sourceAccount||"free";
    if((sourceAccount==="free"||sourceAccount==="unallocated")&&amount>availableFree(profile,data.date))throw new Error("Недостаточно нераспределённых денег для пополнения цели.");
    if(sourceAccount==="reserve"&&amount>reserveBalance(profile))throw new Error("Недостаточно денег в резерве.");
    return {id:data.id,type:"goal_contribution",goalId:goal.id,goalName:goal.name||"Цель",amount,sourceAccount,sourceGoalId:data.sourceGoalId||null,date:data.date,month:data.month||monthKey(data.date),currency:data.currency,note:data.note||""};
  }

  function createGoalWithdrawal(profile,data){
    const goal=goalById(profile,data&&data.goalId);
    if(!goal)throw new Error("Цель не найдена.");
    const amount=nonneg(data&&data.amount);
    if(amount<=0)throw new Error("Сумма вывода должна быть больше нуля.");
    const balance=core.goalBalance(profile,goal);
    if(amount>balance)throw new Error("Нельзя вывести из цели больше её текущего баланса.");
    const destinationAccount=data.destinationAccount||"free";
    if(!["free","unallocated","reserve","goal"].includes(destinationAccount))throw new Error("Неизвестное направление для денег цели.");
    let targetGoalId=null;
    if(destinationAccount==="goal"){
      const target=goalById(profile,data.targetGoalId);
      if(!target||target.status==="closed")throw new Error("Цель назначения недоступна.");
      if(String(target.id)===String(goal.id))throw new Error("Нельзя перевести деньги цели в неё же.");
      if(amount>core.goalRemaining(profile,target))throw new Error("В выбранной цели недостаточно места для всей суммы.");
      targetGoalId=target.id;
    }
    return {id:data.id,type:"goal_withdrawal",goalId:goal.id,goalName:goal.name||"Цель",amount,destinationAccount,targetGoalId,date:data.date,month:data.month||monthKey(data.date),currency:data.currency,note:data.note||""};
  }

  function createGoalTransfer(profile,data){
    const withdrawal=createGoalWithdrawal(profile,{...data,destinationAccount:"goal",id:data.withdrawalId});
    const contribution=createGoalContribution(profile,{id:data.contributionId,goalId:data.targetGoalId,amount:withdrawal.amount,sourceAccount:"goal",sourceGoalId:withdrawal.goalId,date:data.date,month:data.month,currency:data.currency,note:data.note||""});
    return {withdrawal,contribution};
  }

  core.monthStats=monthStats;
  core.availableFree=availableFree;
  core.reserveBalance=reserveBalance;
  core.createGoalContribution=createGoalContribution;
  core.createGoalWithdrawal=createGoalWithdrawal;
  core.createGoalTransfer=createGoalTransfer;
  core.goalLifecycleReplay=replayLedger;
  core.__goalLifecycleBaseMonthStats=baseMonthStats;
})(typeof globalThis!=="undefined"?globalThis:window);
