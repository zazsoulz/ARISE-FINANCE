(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  const reconciliation=root.ARISE_EXPENSE_RECONCILIATION;

  function expenseFunding(profile,{amount,date,categoryId}){
    const available=core&&typeof core.availableFree==="function"
      ? Math.max(0,integer(core.availableFree(profile,date)))
      : 0;

    if(reconciliation&&typeof reconciliation.reconcileExpense==="function"){
      return reconciliation.reconcileExpense({amount,categoryId,availableUnallocated:available});
    }

    const total=Math.max(0,integer(amount));
    const normalizedCategoryId=categoryId||null;

    if(normalizedCategoryId){
      return {
        fundingSource:"category",
        fundingSourceId:normalizedCategoryId,
        controlledAmount:total,
        uncontrolledAmount:0
      };
    }

    const controlledAmount=Math.min(total,available);

    return {
      fundingSource:"unallocated",
      fundingSourceId:null,
      controlledAmount,
      uncontrolledAmount:Math.max(0,total-controlledAmount)
    };
  }

  root.createExpenseTransaction=function(profile,data){
    const amount=Math.max(0,integer(data.amount));
    const date=data.date||today();
    const categoryId=data.categoryId||null;
    const funding=expenseFunding(profile,{amount,date,categoryId});
    const tx={
      id:uid(),
      type:"expense",
      date,
      month:monthKey(date),
      amount,
      source:String(data.source||"").trim(),
      categoryId,
      categoryName:categoryId?String(data.categoryName||"Без категории"):"Нераспределено",
      fundingSource:funding.fundingSource,
      fundingSourceId:funding.fundingSourceId,
      controlledAmount:funding.controlledAmount,
      uncontrolledAmount:funding.uncontrolledAmount,
      currency:data.currency||profile.settings.currency,
      note:String(data.note||"").trim(),
      createdAt:new Date().toISOString()
    };
    profile.transactions.push(tx);
    return tx;
  };

  root.deleteTransaction=function(profile,transactionId){
    profile.transactions=profile.transactions.filter(t=>t.id!==transactionId);
    saveState();
  };

  root.monthTransactions=function(profile,month){
    return (profile.transactions||[]).filter(t=>monthKey(t.month||t.date)===month);
  };

  root.allMonths=function(profile){
    const months=new Set((profile.transactions||[]).map(t=>monthKey(t.month||t.date)).filter(Boolean));
    months.add(monthKey(new Date()));
    return [...months].sort();
  };

  root.lifetimeIncome=function(profile){
    return (profile.transactions||[])
      .filter(t=>t.type==="income")
      .reduce((sum,t)=>sum+number(t.amount),0);
  };

  root.lifetimeExpenses=function(profile){
    return (profile.transactions||[])
      .filter(t=>t.type==="expense")
      .reduce((sum,t)=>sum+number(t.amount),0);
  };

  root.createGoal=function(data){
    const current=Math.max(0,integer(data.current));
    return {
      id:uid(),
      name:String(data.name||"").trim(),
      target:Math.max(0,integer(data.target)),
      current,
      ledgerStart:current,
      priority:clamp(integer(data.priority||3),1,5),
      deadline:data.deadline||"",
      category:data.category||"other",
      monthlyContribution:Math.max(0,integer(data.monthlyContribution)),
      autoAllocate:data.autoAllocate!==false,
      note:String(data.note||"").trim(),
      status:"active",
      createdAt:today(),
      completedAt:""
    };
  };

  root.ARISE_EXPENSE_FUNDING={expenseFunding};
})(typeof globalThis!=="undefined"?globalThis:window);
