(function(root){
  "use strict";

  const history=root.ARISE_GOAL_HISTORY;
  if(!history)return;

  function goalById(profile,id){return (profile.goals||[]).find(goal=>String(goal.id)===String(id));}
  function formatForecastDiff(value){
    if(value===null||typeof value==="undefined")return "Сравнение недоступно для этой цели.";
    if(value===0)return "Фактический срок совпал с первоначальным прогнозом.";
    if(value>0)return `Фактически цель заняла примерно на ${value} мес. дольше первоначального прогноза.`;
    return `Фактически цель достигнута примерно на ${Math.abs(value)} мес. раньше первоначального прогноза.`;
  }

  function showGoalHistory(goalId){
    const profile=activeProfile();
    const goal=goalById(profile,goalId);
    if(!goal)return;
    const info=history.analyzeGoal(profile,goal);
    const forecast=info.initialForecastMonths===null
      ?"Первоначальный прогноз не был сохранён для этой старой цели."
      :`Первоначальный прогноз: ${info.initialForecastMonths} мес.${info.initialForecastDate?` · ориентир ${formatDate(info.initialForecastDate)}`:""}`;

    openModal(`
      <div class="kicker">ИСТОРИЯ ЦЕЛИ</div>
      <h2 class="title">${escapeHTML(goal.name||"Цель")}</h2>
      <div class="sub" style="margin-top:8px">${goal.status==="completed"?"Цель достигнута.":goal.status==="closed"?"Цель закрыта, история сохранена.":"История накопления цели."}</div>
      <div class="stats" style="margin-top:18px">
        <div class="stat"><div class="stat-label">ВНЕСЕНО</div><div class="stat-value">${money(info.contributed)}</div></div>
        <div class="stat"><div class="stat-label">ВЫВЕДЕНО</div><div class="stat-value">${money(info.withdrawn)}</div></div>
        <div class="stat"><div class="stat-label">ПОПОЛНЕНИЙ</div><div class="stat-value">${info.contributionCount}</div></div>
        <div class="stat"><div class="stat-label">СРЕДНЕЕ / МЕС</div><div class="stat-value">${money(info.averageMonthly)}</div></div>
      </div>
      <div class="notice" style="margin-top:14px"><strong>${forecast}</strong><div class="tiny muted" style="margin-top:6px">${formatForecastDiff(info.forecastDifference)}</div>${info.actualMonths!==null?`<div class="tiny muted" style="margin-top:4px">Фактический срок: примерно ${info.actualMonths} мес. · ${info.createdAt?formatDate(info.createdAt):"—"} → ${info.completedAt?formatDate(info.completedAt):"—"}</div>`:""}</div>
      <div class="kicker" style="margin-top:20px">КАК НАКАПЛИВАЛАСЬ ЦЕЛЬ</div>
      <div style="margin-top:8px">${info.events.length?info.events.map(event=>`<div class="row"><div class="row-left"><strong class="${event.direction<0?"negative":"positive"}">${event.direction<0?"−":"+"} ${money(event.amount)}</strong><div class="tiny muted">${escapeHTML(event.label)} · ${event.date?formatDate(event.date):"Без даты"}</div></div><div class="row-right"><div class="pill">${event.type==="withdrawal"?"Вывод":"Пополнение"}</div></div></div>`).join(""):'<div class="empty">Операций по этой цели пока нет.</div>'}</div>
      <div class="actions"><button class="btn primary" id="goalHistoryClose">Готово</button></div>
    `);
    document.getElementById("goalHistoryClose").onclick=closeModal;
  }

  const previousRenderGoals=root.renderGoals;
  if(typeof previousRenderGoals==="function"){
    root.renderGoals=function(){
      const result=previousRenderGoals();
      const profile=activeProfile();
      const page=document.getElementById("page");
      if(!page)return result;

      const completed=(profile.goals||[]).filter(goal=>goal.status==="completed");
      const completedSection=[...page.querySelectorAll(".v3-section")].find(section=>/Достигнутые/i.test(section.textContent||""));
      if(completedSection){
        completedSection.querySelectorAll(".v3-rule").forEach((row,index)=>{
          const goal=completed[index];
          if(!goal||row.querySelector("[data-goal-history]"))return;
          const button=document.createElement("button");
          button.type="button";button.className="btn small-btn";button.dataset.goalHistory=goal.id;button.textContent="История";button.onclick=()=>showGoalHistory(goal.id);row.appendChild(button);
        });
      }

      const closed=(profile.goals||[]).filter(goal=>goal.status==="closed");
      const closedSection=page.querySelector(".goal-closed-section");
      if(closedSection){
        closedSection.querySelectorAll(".v3-rule").forEach((row,index)=>{
          const goal=closed[index];
          if(!goal||row.querySelector("[data-goal-history]"))return;
          const button=document.createElement("button");
          button.type="button";button.className="btn small-btn";button.dataset.goalHistory=goal.id;button.textContent="История";button.onclick=()=>showGoalHistory(goal.id);row.appendChild(button);
        });
      }
      return result;
    };
  }

  root.ARISE_GOAL_HISTORY_UI={showGoalHistory};
})(typeof globalThis!=="undefined"?globalThis:window);
