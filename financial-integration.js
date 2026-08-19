(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  if(!core){
    console.error("ARISE financial core is not available.");
    return;
  }

  function categoryName(profile,id){
    const category=(profile.categories||[]).find(item=>String(item.id)===String(id));
    if(category&&category.name) return category.name;
    for(const tx of profile.transactions||[]){
      for(const allocation of tx.allocations||[]){
        if(String(allocation.categoryId)===String(id)&&allocation.name) return allocation.name;
      }
    }
    return "Без категории";
  }

  function goalById(profile,id){
    return (profile.goals||[]).find(goal=>String(goal.id)===String(id));
  }

  function ensureGoalLedger(goal){
    if(!goal) return;
    if(!Number.isFinite(Number(goal.ledgerStart))){
      goal.ledgerStart=Math.max(0,integer(goal.current||0));
    }
  }

  function syncGoal(profile,goal){
    if(!goal) return;
    goal.current=core.goalBalance(profile,goal);
    if(goal.target>0&&goal.current>=goal.target){
      goal.status="completed";
      goal.completedAt||=today();
    }else{
      goal.status="active";
      goal.completedAt="";
    }
  }

  root.calculateIncomePlan=function(profile,income,date){
    return core.planIncome(profile,income,date,profile&&profile.transactions);
  };

  root.validatePlan=function(plan){
    return core.validatePlan(plan);
  };

  root.createIncomeTransaction=function(profile,data){
    const date=data.date||today();
    const goalAllocations=clone(data.goalAllocations||[]);

    for(const allocation of goalAllocations){
      ensureGoalLedger(goalById(profile,allocation.goalId));
    }

    const tx=core.createIncomeTransaction({
      id:uid(),
      total:data.amount,
      date,
      month:monthKey(date),
      currency:data.currency||profile.settings.currency,
      source:String(data.source||"").trim(),
      note:String(data.note||"").trim(),
      allocations:clone(data.allocations||[]),
      goalAllocations,
      reserve:data.reserve||0
    });

    tx.createdAt=new Date().toISOString();
    profile.transactions.push(tx);

    for(const allocation of goalAllocations){
      syncGoal(profile,goalById(profile,allocation.goalId));
    }

    return tx;
  };

  root.monthStats=function(profile,month){
    const stats=core.monthStats(profile,month);
    const allocations={};

    for(const [id,value] of Object.entries(stats.categoryBalances)){
      const name=categoryName(profile,id);
      allocations[name]=(allocations[name]||0)+value;
    }

    for(const [id,value] of Object.entries(stats.goalAllocated||{})){
      const goal=goalById(profile,id);
      const name=`Цель · ${goal&&goal.name?goal.name:"Без названия"}`;
      allocations[name]=(allocations[name]||0)+value;
    }

    allocations["Свободные деньги"]=stats.free;

    return {
      income:stats.income,
      expenses:stats.expenses,
      reserve:stats.reserve,
      reserveWithdrawn:stats.reserveWithdrawn,
      allocations,
      operations:stats.operationCount,
      free:stats.free,
      uncontrolled:stats.uncontrolled,
      goalAllocated:stats.goalAllocated
    };
  };

  root.currentFreeMoney=function(profile,month=activeMonth){
    return core.monthStats(profile,month).free;
  };

  root.lifetimeReserve=function(profile){
    return core.reserveBalance(profile);
  };

  root.goalRemaining=function(goal){
    return core.goalRemaining(activeProfile(),goal);
  };

  root.goalPercent=function(goal){
    const profile=activeProfile();
    const target=Math.max(0,integer(goal&&goal.target));
    if(!target) return 0;
    return clamp(core.goalBalance(profile,goal)/target*100,0,100);
  };

  root.goalMonthlyNeed=function(goal){
    return core.goalMonthlyNeed(activeProfile(),goal,today());
  };

  root.goalForecast=function(goal){
    const projection=core.goalProjection(activeProfile(),goal,today());
    if(projection.remaining<=0) return "Цель достигнута";
    if(!Number.isFinite(projection.months)||projection.months<=0) return "Нужен план пополнения";

    const date=new Date();
    date.setMonth(date.getMonth()+projection.months);
    const forecast=date.toLocaleDateString("ru-RU",{month:"long",year:"numeric"});

    if(goal.deadline){
      const deadline=new Date(goal.deadline+"T23:59:59");
      if(date>deadline) return `Не успевает к ${formatDate(goal.deadline)} · прогноз ${forecast}`;
    }
    return "Прогноз: "+forecast;
  };

  root.renderIncomePlan=function(plan){
    const currency=document.getElementById("incomeCurrency").value;
    document.getElementById("incomePlan").innerHTML=`
      <div class="notice">
        ARISE построил предложение автоматически. Ты можешь изменить любую сумму ниже.
      </div>
      <div class="plan-total" style="margin-top:15px">
        <div><div class="kicker">ДОХОД</div><strong>${money(plan.total,currency)}</strong></div>
        <div class="plan-balance"><div class="label">СВОБОДНЫЕ ПОСЛЕ ПЛАНА</div><div class="value" id="planDifference">0 ${currencySymbol(currency)}</div></div>
      </div>
      <div class="plan-editor" id="planEditor">
        ${(plan.allocations||[]).map((item,index)=>`
          <div class="plan-line">
            <div class="plan-line-name"><strong>${escapeHTML(item.name)}</strong><span>${item.fixed?"фиксированная сумма":item.percent+"%"}</span></div>
            <input class="plan-amount" data-index="${index}" type="number" min="0" value="${item.amount}">
            <div class="plan-percent">${item.percent?item.percent+"%":""}</div>
          </div>`).join("")}
        ${(plan.goalAllocations||[]).map((item,index)=>`
          <div class="plan-line">
            <div class="plan-line-name"><strong>${escapeHTML(item.name)}</strong><span>цель · приоритет ${item.priority}${item.deadline?" · до "+formatDate(item.deadline):""}</span></div>
            <input class="plan-goal-amount" data-index="${index}" type="number" min="0" value="${item.amount}">
            <div class="plan-percent">цель</div>
          </div>`).join("")}
        <div class="plan-line">
          <div class="plan-line-name"><strong>Резерв</strong><span>отдельный денежный баланс</span></div>
          <input id="planReserve" type="number" min="0" value="${plan.reserve}">
          <div class="plan-percent">${activeProfile().settings.reserve.enabled?activeProfile().settings.reserve.percent+"%":""}</div>
        </div>
      </div>
      <div id="planMessage" style="margin-top:12px"></div>
      <div class="actions"><button class="btn primary" id="saveIncome">Сохранить доход</button></div>
    `;

    currentIncomePlan=clone(plan);
    root.updateIncomePlanUI(plan);

    document.querySelectorAll(".plan-amount,.plan-goal-amount").forEach(input=>{
      input.oninput=()=>root.updateIncomePlanUI(plan);
    });
    document.getElementById("planReserve").oninput=()=>root.updateIncomePlanUI(plan);
    document.getElementById("saveIncome").onclick=()=>root.saveIncomeFromModal(plan);
  };

  root.readIncomePlanFromUI=function(){
    const allocations=[...document.querySelectorAll(".plan-amount")].map(input=>{
      const original=currentIncomePlan&&currentIncomePlan.allocations
        ? currentIncomePlan.allocations[Number(input.dataset.index)]
        : {};
      return {...original,amount:Math.max(0,integer(input.value))};
    });

    const goalAllocations=[...document.querySelectorAll(".plan-goal-amount")].map(input=>{
      const original=currentIncomePlan&&currentIncomePlan.goalAllocations
        ? currentIncomePlan.goalAllocations[Number(input.dataset.index)]
        : {};
      return {...original,amount:Math.max(0,integer(input.value))};
    });

    const reserve=Math.max(0,integer(document.getElementById("planReserve")?.value));
    return {allocations,goalAllocations,reserve};
  };

  root.updateIncomePlanUI=function(plan){
    if(!currentIncomePlan) currentIncomePlan=clone(plan);
    const data=root.readIncomePlanFromUI();
    const validation=core.validatePlan({
      total:plan.total,
      allocations:data.allocations,
      goalAllocations:data.goalAllocations,
      reserve:data.reserve
    });
    const currency=document.getElementById("incomeCurrency").value;
    const differenceEl=document.getElementById("planDifference");

    if(differenceEl){
      differenceEl.textContent=money(validation.valid?validation.remainder:validation.difference,currency);
      differenceEl.className="value "+(validation.valid?"positive":"negative");
    }

    const message=document.getElementById("planMessage");
    if(!message) return;
    if(!validation.valid){
      message.innerHTML=`<div class="notice danger">Ты распределил больше дохода на <strong>${money(Math.abs(validation.difference),currency)}</strong>.</div>`;
    }else if(validation.remainder>0){
      message.innerHTML=`<div class="notice">В «Свободные деньги» перейдёт <strong>${money(validation.remainder,currency)}</strong>. Можно сохранять.</div>`;
    }else{
      message.innerHTML=`<div class="notice">Распределение сходится. Можно сохранять.</div>`;
    }
  };

  root.saveIncomeFromModal=function(plan){
    const profile=activeProfile();
    const data=root.readIncomePlanFromUI();
    const validation=core.validatePlan({
      total:plan.total,
      allocations:data.allocations,
      goalAllocations:data.goalAllocations,
      reserve:data.reserve
    });
    if(!validation.valid){
      toast("Распределение превышает доход.");
      return;
    }

    for(const allocation of data.goalAllocations){
      const goal=goalById(profile,allocation.goalId);
      if(!goal||goal.status==="completed"){
        toast("Одна из целей уже недоступна для пополнения.");
        return;
      }
      if(integer(allocation.amount)>core.goalRemaining(profile,goal)){
        toast(`На цель «${goal.name}» направлено больше, чем осталось накопить.`);
        return;
      }
    }

    const date=document.getElementById("incomeDate").value||today();
    root.createIncomeTransaction(profile,{
      amount:plan.total,
      source:document.getElementById("incomeSource").value,
      date,
      currency:document.getElementById("incomeCurrency").value,
      note:document.getElementById("incomeNote").value,
      allocations:data.allocations,
      goalAllocations:data.goalAllocations,
      reserve:data.reserve
    });

    saveState();
    closeModal();
    activeMonth=monthKey(date);
    toast("Доход сохранён.");
    activePage="home";
    render();
  };

  root.showGoalFundModal=function(goalId){
    const profile=activeProfile();
    const goal=goalById(profile,goalId);
    if(!goal) return;

    const balance=core.goalBalance(profile,goal);
    const free=core.availableFree(profile,today());
    const remaining=core.goalRemaining(profile,goal);

    openModal(`
      <div class="kicker">ПОПОЛНЕНИЕ ЦЕЛИ</div>
      <h2 class="title">${escapeHTML(goal.name)}</h2>
      <div class="sub" style="margin-top:7px">${money(balance)} из ${money(goal.target)} · свободно сейчас ${money(free)}</div>
      <div class="field" style="margin-top:18px"><label>Сумма из свободных денег</label><input id="fundAmount" type="number" min="1" max="${remaining}" placeholder="10000"></div>
      <div id="fundPreview" style="margin-top:14px"></div>
      <div class="actions"><button class="btn primary" id="saveFund">Пополнить</button><button class="btn" id="cancelFund">Отмена</button></div>
    `);

    const amountInput=document.getElementById("fundAmount");
    const update=()=>{
      const amount=Math.max(0,integer(amountInput.value));
      const preview=document.getElementById("fundPreview");
      if(!amount){preview.innerHTML="";return;}
      if(amount>remaining){
        preview.innerHTML=`<div class="notice warning">До цели осталось ${money(remaining)}.</div>`;
      }else if(amount>free){
        preview.innerHTML=`<div class="notice danger">Недостаточно свободных денег. Доступно ${money(free)}.</div>`;
      }else{
        preview.innerHTML=`<div class="notice">После перевода свободными останется ${money(free-amount)}.</div>`;
      }
    };
    amountInput.oninput=update;
    document.getElementById("cancelFund").onclick=closeModal;
    document.getElementById("saveFund").onclick=()=>{
      const amount=Math.max(0,integer(amountInput.value));
      try{
        const tx=core.createGoalContribution(profile,{
          id:uid(),goalId:goal.id,amount,sourceAccount:"free",date:today(),currency:profile.settings.currency
        });
        ensureGoalLedger(goal);
        tx.createdAt=new Date().toISOString();
        profile.transactions.push(tx);
        syncGoal(profile,goal);
        saveState();
        closeModal();
        toast(goal.status==="completed"?"Цель достигнута.":"Деньги переведены в цель.");
        render();
      }catch(error){
        toast(error.message||"Не удалось пополнить цель.");
      }
    };
  };

  root.historyTransaction=function(tx){
    if(tx.type==="goal_contribution"){
      return `<div class="row"><div class="row-left"><strong>${money(tx.amount,tx.currency)}</strong><div class="tiny muted">Перевод в цель · ${escapeHTML(tx.goalName||"Цель")} · ${formatDate(tx.date)}</div></div><div class="row-right"><div class="pill">Цель</div></div></div>`;
    }
    if(tx.type==="reserve_withdrawal"){
      return `<div class="row"><div class="row-left"><strong class="negative">- ${money(tx.amount,tx.currency)}</strong><div class="tiny muted">Из резерва · ${escapeHTML(tx.source||"Списание")} · ${formatDate(tx.date)}</div></div><div class="row-right"><div class="pill">Резерв</div></div></div>`;
    }
    if(tx.type==="income"){
      return `
        <div class="row"><div class="row-left"><strong class="positive">+ ${money(tx.amount,tx.currency)}</strong><div class="tiny muted">${escapeHTML(tx.source||"Источник не указан")} · ${formatDate(tx.date)}</div></div><div class="row-right"><div class="pill">Доход</div></div></div>
        <div class="allocation-grid" style="margin-top:0">
          ${(tx.allocations||[]).map(item=>`<div class="allocation"><div class="allocation-name">${escapeHTML(item.name)}</div><div class="allocation-value">${money(item.amount,tx.currency)}</div></div>`).join("")}
          ${(tx.goalAllocations||[]).map(item=>`<div class="allocation"><div class="allocation-name">ЦЕЛЬ · ${escapeHTML(item.name)}</div><div class="allocation-value">${money(item.amount,tx.currency)}</div></div>`).join("")}
          ${tx.reserve?`<div class="allocation"><div class="allocation-name">РЕЗЕРВ</div><div class="allocation-value">${money(tx.reserve,tx.currency)}</div></div>`:""}
          ${core.historicalRemainder(tx)?`<div class="allocation"><div class="allocation-name">СВОБОДНЫЕ ДЕНЬГИ</div><div class="allocation-value">${money(core.historicalRemainder(tx),tx.currency)}</div></div>`:""}
        </div>`;
    }
    return `<div class="row"><div class="row-left"><strong class="negative">- ${money(tx.amount,tx.currency)}</strong><div class="tiny muted">${escapeHTML(tx.categoryName||"Свободные деньги")} · ${escapeHTML(tx.source||"Без описания")} · ${formatDate(tx.date)}</div></div><div class="row-right"><div class="pill">Расход</div></div></div>`;
  };

  if(typeof root.render==="function") root.render();
})(typeof globalThis!=="undefined"?globalThis:window);
