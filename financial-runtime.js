(function(root){
  "use strict";

  root.createExpenseTransaction=function(profile,data){
    const amount=Math.max(0,integer(data.amount));
    const date=data.date||today();
    const tx={
      id:uid(),
      type:"expense",
      date,
      month:monthKey(date),
      amount,
      source:String(data.source||"").trim(),
      categoryId:data.categoryId||null,
      categoryName:String(data.categoryName||"Нераспределено"),
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
})(typeof globalThis!=="undefined"?globalThis:window);
