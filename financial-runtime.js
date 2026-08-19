(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  const reconciliation=root.ARISE_EXPENSE_RECONCILIATION;

  function expenseFunding(profile,{amount,date,categoryId}){
    const stats=core&&typeof core.monthStats==="function"?core.monthStats(profile,monthKey(date)):null;
    const availableUnallocated=core&&typeof core.availableFree==="function"?Math.max(0,integer(core.availableFree(profile,date))):0;
    const availableCategory=categoryId&&stats&&stats.categoryBalances?Math.max(0,integer(stats.categoryBalances[categoryId]||0)):0;

    if(reconciliation&&typeof reconciliation.reconcileExpense==="function"){
      return reconciliation.reconcileExpense({amount,categoryId,availableUnallocated,availableCategory});
    }

    const total=Math.max(0,integer(amount));
    const normalizedCategoryId=categoryId||null;
    const categoryAmount=normalizedCategoryId?Math.min(total,availableCategory):0;
    const unallocatedAmount=Math.min(total-categoryAmount,availableUnallocated);
    const uncontrolledAmount=Math.max(0,total-categoryAmount-unallocatedAmount);
    return {
      fundingSource:normalizedCategoryId?"category":"unallocated",
      fundingSourceId:normalizedCategoryId,
      controlledAmount:categoryAmount+unallocatedAmount,
      categoryControlledAmount:categoryAmount,
      unallocatedControlledAmount:unallocatedAmount,
      uncontrolledAmount,
      fundingBreakdown:{category:categoryAmount,unallocated:unallocatedAmount,uncontrolled:uncontrolledAmount}
    };
  }

  root.createExpenseTransaction=function(profile,data){
    const amount=Math.max(0,integer(data.amount));
    const date=data.date||today();
    const categoryId=data.categoryId||null;
    const funding=expenseFunding(profile,{amount,date,categoryId});
    const tx={
      id:uid(),type:"expense",date,month:monthKey(date),amount,
      source:String(data.source||"").trim(),
      categoryId,
      categoryName:categoryId?String(data.categoryName||"Без категории"):"Нераспределено",
      fundingSource:funding.fundingSource,
      fundingSourceId:funding.fundingSourceId,
      controlledAmount:funding.controlledAmount,
      categoryControlledAmount:funding.categoryControlledAmount||0,
      unallocatedControlledAmount:funding.unallocatedControlledAmount||0,
      uncontrolledAmount:funding.uncontrolledAmount,
      fundingBreakdown:{...(funding.fundingBreakdown||{})},
      currency:data.currency||profile.settings.currency,
      note:String(data.note||"").trim(),
      createdAt:new Date().toISOString()
    };
    profile.transactions.push(tx);
    return tx;
  };

  root.deleteTransaction=function(profile,transactionId){profile.transactions=profile.transactions.filter(t=>t.id!==transactionId);saveState();};
  root.monthTransactions=function(profile,month){return (profile.transactions||[]).filter(t=>monthKey(t.month||t.date)===month);};
  root.allMonths=function(profile){const months=new Set((profile.transactions||[]).map(t=>monthKey(t.month||t.date)).filter(Boolean));months.add(monthKey(new Date()));return [...months].sort();};
  root.lifetimeIncome=function(profile){return (profile.transactions||[]).filter(t=>t.type==="income").reduce((sum,t)=>sum+number(t.amount),0);};
  root.lifetimeExpenses=function(profile){return (profile.transactions||[]).filter(t=>t.type==="expense").reduce((sum,t)=>sum+number(t.amount),0);};

  root.createGoal=function(data){
    const current=Math.max(0,integer(data.current));
    return {
      id:uid(),name:String(data.name||"").trim(),target:Math.max(0,integer(data.target)),current,ledgerStart:current,
      priority:clamp(integer(data.priority||3),1,5),deadline:data.deadline||"",category:data.category||"other",
      monthlyContribution:Math.max(0,integer(data.monthlyContribution)),autoAllocate:data.autoAllocate!==false,
      note:String(data.note||"").trim(),status:"active",createdAt:today(),completedAt:""
    };
  };

  root.ARISE_EXPENSE_FUNDING={expenseFunding};
})(typeof globalThis!=="undefined"?globalThis:window);