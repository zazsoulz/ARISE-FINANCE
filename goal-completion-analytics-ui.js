(function(root){
  "use strict";

  const analytics=root.ARISE_GOAL_COMPLETION_ANALYTICS;
  if(!analytics)return;

  const previousRenderAnalytics=root.renderAnalytics;
  if(typeof previousRenderAnalytics!=="function")return;

  function durationLabel(months){
    if(!Number.isFinite(months))return "срок не сохранён";
    return `≈ ${months} мес.`;
  }

  function forecastLabel(diff){
    if(!Number.isFinite(diff))return "без исходного прогноза";
    if(diff===0)return "по первоначальному прогнозу";
    return diff<0?`${Math.abs(diff)} мес. раньше прогноза`:`${diff} мес. позже прогноза`;
  }

  function renderCard(profile){
    const data=analytics.summary(profile);
    if(!data.total)return `<section class="analytics-card"><div class="analytics-section-title"><div><div class="analytics-label">Достигнутые цели</div><h2>История результата</h2></div><span>0</span></div><div class="analytics-empty">После достижения первой цели здесь появится фактический срок и сравнение с первоначальным прогнозом.</div></section>`;

    return `<section class="analytics-card" data-completed-goal-analytics><div class="analytics-section-title"><div><div class="analytics-label">Достигнутые цели</div><h2>Фактический результат</h2></div><span>${data.total}</span></div>
      <div class="stats" style="margin-top:14px">
        <div class="stat"><div class="stat-label">ДОСТИГНУТО</div><div class="stat-value">${data.total}</div></div>
        <div class="stat"><div class="stat-label">СРЕДНИЙ СРОК</div><div class="stat-value">${data.averageActualMonths===null?"—":`${data.averageActualMonths.toLocaleString("ru-RU",{maximumFractionDigits:1})} мес.`}</div></div>
        <div class="stat"><div class="stat-label">РАНЬШЕ ПРОГНОЗА</div><div class="stat-value positive">${data.ahead}</div></div>
        <div class="stat"><div class="stat-label">ПОЗЖЕ ПРОГНОЗА</div><div class="stat-value ${data.behind?"warning":""}">${data.behind}</div></div>
      </div>
      <div style="margin-top:14px">${data.goals.slice(0,4).map(goal=>`<div class="row"><div class="row-left"><strong>${escapeHTML(goal.name)}</strong><div class="tiny muted">${goal.completedAt?`достигнута ${formatDate(goal.completedAt)} · `:""}${escapeHTML(durationLabel(goal.actualMonths))} · ${escapeHTML(forecastLabel(goal.forecastDifference))}</div></div><div class="row-right"><strong>${money(goal.contributed)}</strong></div></div>`).join("")}</div>
      <div class="analytics-note" style="margin-top:12px">Показатели рассчитаны из истории операций цели. Завершение считается фактом достижения целевого баланса, а не ручным счётчиком.</div>
    </section>`;
  }

  root.renderAnalytics=function(){
    const result=previousRenderAnalytics();
    const grid=document.querySelector(".arise-analytics .analytics-grid");
    if(grid&&!grid.querySelector("[data-completed-goal-analytics]"))grid.insertAdjacentHTML("beforeend",renderCard(activeProfile()));
    return result;
  };

  root.ARISE_GOAL_COMPLETION_ANALYTICS_UI={renderCard,durationLabel,forecastLabel};
})(typeof globalThis!=="undefined"?globalThis:window);
