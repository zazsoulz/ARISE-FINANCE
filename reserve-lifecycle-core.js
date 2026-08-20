(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  if(!core)return;

  const baseMonthStats=core.monthStats.bind(core);
  const baseAvailableFree=core.availableFree.bind(core);
  const baseReserveBalance=core.reserveBalance.bind(core);
  const safe=value=>Math.max(0,Math.round(Number(value)||0));
  const asArray=value=>Array.isArray(value)?value:[];
  const txMonth=tx=>String(tx&&tx.month||core.monthKey(tx&&tx.date));

  function reserveFreeFlow(profile,throughMonth){
    let delta=0;
    for(const tx of asArray(profile&&profile.transactions)){
      if(throughMonth&&txMonth(tx)>throughMonth)continue;
      const amount=safe(tx&&tx.amount);
      if(tx.type==="reserve_deposit"&&(!tx.sourceAccount||tx.sourceAccount==="free"||tx.sourceAccount==="unallocated"))delta-=amount;
      if(tx.type==="reserve_withdrawal"&&(!tx.destinationAccount||tx.destinationAccount==="free"||tx.destinationAccount==="unallocated"))delta+=amount;
    }
    return delta;
  }

  function monthReserveFlow(profile,key){
    let deposits=0,withdrawals=0,freeSpent=0,freeGenerated=0;
    for(const tx of asArray(profile&&profile.transactions)){
      if(txMonth(tx)!==key)continue;
      const amount=safe(tx&&tx.amount);
      if(tx.type==="reserve_deposit"){
        deposits+=amount;
        if(!tx.sourceAccount||tx.sourceAccount==="free"||tx.sourceAccount==="unallocated")freeSpent+=amount;
      }
      if(tx.type==="reserve_withdrawal"){
        withdrawals+=amount;
        if(!tx.destinationAccount||tx.destinationAccount==="free"||tx.destinationAccount==="unallocated")freeGenerated+=amount;
      }
    }
    return {deposits,withdrawals,freeSpent,freeGenerated};
  }

  function monthStats(profile,key){
    const stats=baseMonthStats(profile,key);
    const flow=monthReserveFlow(profile,key);
    const cumulative=reserveFreeFlow(profile,key);
    return {
      ...stats,
      reserve:safe(stats.reserve)+flow.deposits,
      reserveWithdrawn:safe(stats.reserveWithdrawn),
      free:Math.max(0,safe(stats.free)+cumulative),
      freeSpent:safe(stats.freeSpent)+flow.freeSpent,
      freeGenerated:safe(stats.freeGenerated)+flow.freeGenerated
    };
  }

  function availableFree(profile,date){
    const key=core.monthKey(date);
    return Math.max(0,safe(baseAvailableFree(profile,date))+reserveFreeFlow(profile,key));
  }

  function reserveBalance(profile){return Math.max(0,safe(baseReserveBalance(profile)));}

  function createReserveDeposit(profile,data){
    const amount=safe(data&&data.amount);
    if(amount<=0)throw new Error("Сумма пополнения резерва должна быть больше нуля.");
    const date=data&&data.date||new Date().toISOString().slice(0,10);
    if(amount>availableFree(profile,date))throw new Error("Недостаточно нераспределённых денег для пополнения резерва.");
    return {
      id:data.id,type:"reserve_deposit",amount,date,month:data.month||core.monthKey(date),currency:data.currency,
      sourceAccount:"free",destinationAccount:"reserve",source:data.source||"Пополнение резерва",note:data.note||""
    };
  }

  function createReserveWithdrawal(profile,data){
    const amount=safe(data&&data.amount);
    if(amount<=0)throw new Error("Сумма вывода из резерва должна быть больше нуля.");
    if(amount>reserveBalance(profile))throw new Error("Недостаточно денег в резерве.");
    const date=data&&data.date||new Date().toISOString().slice(0,10);
    return {
      id:data.id,type:"reserve_withdrawal",amount,date,month:data.month||core.monthKey(date),currency:data.currency,
      sourceAccount:"reserve",destinationAccount:"free",source:data.source||"Вывод из резерва",note:data.note||""
    };
  }

  core.monthStats=monthStats;
  core.availableFree=availableFree;
  core.reserveBalance=reserveBalance;
  core.createReserveDeposit=createReserveDeposit;
  core.createReserveWithdrawal=createReserveWithdrawal;
  core.reserveFreeFlow=reserveFreeFlow;
  core.monthReserveFlow=monthReserveFlow;
})(typeof globalThis!=="undefined"?globalThis:window);
