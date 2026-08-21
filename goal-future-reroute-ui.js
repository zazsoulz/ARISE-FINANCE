(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  if(!core||typeof core.setGoalFutureRule!=="function")return;

  const previousRenderGoals=root.renderGoals;
  const safe=value=>Math.max(0,Math.round(Number(value)||0));
  const rid=entity=>entity&&entity.ariseSync&&entity.ariseSync.remoteId||null;
  const goalById=(profile,id)=>(profile.goals||[]).find(goal=>String(goal.id)===String(id));

  function destinationLabel(profile,value){
    const normalized=String(value||"");
    if(normalized==="free")return "в нераспределённый остаток";
    if(normalized==="reserve")return "в резерв";
    if(normalized.startsWith("category:")){
      const id=normalized.slice(9);
      const category=(profile.categories||[]).find(item=>String(item.id)===id||String(rid(item))===id);
      return category?`в категорию «${category.name}»`:"в нераспределённый остаток · назначение недоступно";
    }
    if(normalized.startsWith("goal:")){
      const id=normalized.slice(5);
      const goal=(profile.goals||[]).find(item=>String(item.id)===id||String(rid(item))===id);
      return goal?`в цель «${goal.name}»`:"в нераспределённый остаток · назначение недоступно";
    }
    return "не настроено";
  }

  function eligibleDestinations(profile,sourceGoal){
    const rows=[{value:"free",label:"В нераспределённый остаток"}];
    if(profile.settings&&profile.settings.reserve&&profile.settings.reserve.enabled)rows.push({value:"reserve",label:"В резерв"});
    for(const category of profile.categories||[]){
      if(category.enabled===false)continue;
      rows.push({value:`category:${category.id}`,label:`В категорию · ${category.name||"Категория"}`});
    }
    for(const goal of profile.goals||[]){
      if(String(goal.id)===String(sourceGoal.id)||goal.status==="closed"||goal.status==="completed")continue;
      rows.push({value:`goal:${goal.id}`,label:`В цель · ${goal.name||"Цель"}`});
    }
    return rows;
  }

  function futureRulePresentation(profile,goal){
    const rule=core.goalFutureRule(profile,goal);
    if(!rule){
      return {
        configured:false,
        state:"pending",
        label:"Следующий поток не настроен",
        detail:"Прежний ежемесячный взнос не закреплён за новым назначением."
      };
    }
    return {
      configured:true,
      state:"configured",
      label:"Следующий поток",
      detail:`${money(rule.monthlyAmount)} / мес. → ${destinationLabel(profile,rule.destination)}`,
      rule
    };
  }

  function showFutureRerouteModal(goalId){
    const profile=activeProfile();
    const goal=goalById(profile,goalId);
    if(!goal||goal.status!=="completed")return;
    const rule=core.goalFutureRule(profile,goal);
    const defaultAmount=safe(rule&&rule.monthlyAmount||goal.monthlyContribution||0);
    const options=eligibleDestinations(profile,goal);
    const current=rule&&rule.destination||"free";

    openModal(`
      <div class="kicker">БУДУЩИЕ ДЕНЬГИ ЦЕЛИ</div>
      <h2 class="title">${escapeHTML(goal.name||"Цель")}</h2>
      <div class="sub" style="margin-top:8px">Цель достигнута. Выбери, куда ARISE будет направлять её прежний ежемесячный поток при следующих доходах.</div>
      <div class="field" style="margin-top:18px"><label>Сумма в месяц</label><input id="goalFutureAmount" inputmode="decimal" value="${defaultAmount||""}" placeholder="Например, 10 000"></div>
      <div class="field"><label>Куда направлять</label><select id="goalFutureDestination">${options.map(option=>`<option value="${escapeHTML(option.value)}" ${option.value===current?"selected":""}>${escapeHTML(option.label)}</option>`).join("")}</select></div>
      <div class="notice" style="margin-top:14px">Правило применяется только к будущим доходам и не меняет историю уже завершённой цели. Если выбранное назначение достигнет лимита, недоступная часть останется в нераспределённом остатке.</div>
      <div class="actions"><button class="btn primary" id="saveGoalFutureRule">Сохранить правило</button>${rule?'<button class="btn" id="clearGoalFutureRule">Отключить</button>':''}<button class="btn" id="cancelGoalFutureRule">Отмена</button></div>
    `);

    document.getElementById("cancelGoalFutureRule").onclick=closeModal;
    const clear=document.getElementById("clearGoalFutureRule");
    if(clear)clear.onclick=()=>{
      core.clearGoalFutureRule(profile,goal);
      if(root.ARISE_SYNC&&root.ARISE_SYNC.markDirty)root.ARISE_SYNC.markDirty(profile);
      saveState();closeModal();toast("Перенаправление будущих денег отключено.");render();
    };
    document.getElementById("saveGoalFutureRule").onclick=()=>{
      const amount=safe(document.getElementById("goalFutureAmount")?.value);
      const destination=document.getElementById("goalFutureDestination")?.value||"free";
      try{
        core.setGoalFutureRule(profile,goal,{destination,monthlyAmount:amount});
        if(root.ARISE_SYNC&&root.ARISE_SYNC.markDirty)root.ARISE_SYNC.markDirty(profile);
        saveState();closeModal();toast(`Будущие деньги цели будут направляться ${destinationLabel(profile,destination)}.`);render();
      }catch(error){toast(error.message||"Не удалось сохранить правило.");}
    };
  }

  if(typeof previousRenderGoals==="function"){
    root.renderGoals=function(){
      previousRenderGoals();
      const profile=activeProfile();
      const page=document.getElementById("page");
      if(!page)return;
      const completed=(profile.goals||[]).filter(goal=>goal.status==="completed");
      const section=page.querySelector("[data-completed-goals]")||[...page.querySelectorAll(".v3-section")].find(item=>/Достигнутые/i.test(item.textContent||""));
      if(!section)return;
      const rows=[...section.querySelectorAll(".v3-rule")];
      completed.forEach((goal,index)=>{
        const row=rows.find(item=>String(item.dataset.completedGoalId||"")===String(goal.id))||rows[index];if(!row)return;
        const presentation=futureRulePresentation(profile,goal);
        row.classList.add("goal-completed-row");
        const info=document.createElement("div");
        info.className=`goal-future-flow is-${presentation.state}`;
        info.dataset.goalFutureState=presentation.state;
        const label=document.createElement("span");label.className="goal-future-flow-label";label.textContent=presentation.label;
        const detail=document.createElement("strong");detail.className="goal-future-flow-detail";detail.textContent=presentation.detail;
        info.append(label,detail);
        const left=row.querySelector("div")||row;left.appendChild(info);
        let actions=row.querySelector(".goal-completed-actions");
        if(!actions){actions=document.createElement("div");actions.className="goal-completed-actions";row.appendChild(actions);}
        const button=document.createElement("button");
        button.type="button";button.className="btn small-btn";button.dataset.goalFutureReroute=goal.id;
        button.textContent=presentation.configured?"Изменить маршрут":"Настроить следующий поток";
        button.setAttribute("aria-label",`${presentation.configured?"Изменить маршрут":"Настроить следующий поток"} цели «${goal.name||"Цель"}»`);
        button.onclick=()=>showFutureRerouteModal(goal.id);
        actions.prepend(button);
      });
      const pending=completed.filter(goal=>!core.goalFutureRule(profile,goal));
      if(pending.length){
        const notice=document.createElement("div");notice.className="notice goal-future-pending";
        notice.textContent=`${pending.length===1?"У одной достигнутой цели":"У нескольких достигнутых целей"} следующий поток не настроен. Без отдельного правила ARISE не резервирует прежний ежемесячный взнос для нового назначения.`;
        section.insertBefore(notice,section.children[1]||null);
      }
    };
  }

  root.ARISE_GOAL_FUTURE_REROUTE_UI={showFutureRerouteModal,destinationLabel,eligibleDestinations,futureRulePresentation};
})(typeof globalThis!=="undefined"?globalThis:window);
