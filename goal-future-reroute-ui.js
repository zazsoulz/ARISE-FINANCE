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
      const section=[...page.querySelectorAll(".v3-section")].find(item=>/Достигнутые/i.test(item.textContent||""));
      if(!section)return;
      const rows=[...section.querySelectorAll(".v3-rule")];
      completed.forEach((goal,index)=>{
        const row=rows[index];if(!row)return;
        const rule=core.goalFutureRule(profile,goal);
        const info=document.createElement("div");
        info.className="goal-future-rule-summary tiny muted";
        info.textContent=rule?`${money(rule.monthlyAmount)} / мес. → ${destinationLabel(profile,rule.destination)}`:"Будущие деньги ещё не настроены";
        const left=row.querySelector("div")||row;left.appendChild(info);
        const button=document.createElement("button");
        button.type="button";button.className="btn small-btn";button.dataset.goalFutureReroute=goal.id;
        button.textContent=rule?"Изменить поток":"Будущие деньги";
        button.onclick=()=>showFutureRerouteModal(goal.id);
        row.appendChild(button);
      });
      const pending=completed.filter(goal=>!core.goalFutureRule(profile,goal));
      if(pending.length){
        const notice=document.createElement("div");notice.className="notice goal-future-pending";
        notice.textContent=`${pending.length===1?"У завершённой цели":"У завершённых целей"} не настроено направление будущих денег.`;
        section.insertBefore(notice,section.children[1]||null);
      }
    };
  }

  root.ARISE_GOAL_FUTURE_REROUTE_UI={showFutureRerouteModal,destinationLabel,eligibleDestinations};
})(typeof globalThis!=="undefined"?globalThis:window);
