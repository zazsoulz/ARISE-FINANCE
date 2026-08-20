(function(root){
  "use strict";
  const analytics=root.ARISE_ANALYTICS;
  const ui=root.ARISE_ANALYTICS_UI;
  const previous=root.renderAnalytics;
  if(!analytics||!ui||typeof previous!=="function")return;

  function bars(rows){
    if(!rows.length)return `<div class="analytics-empty">Расходов в этом месяце пока нет.</div>`;
    return `<div class="analytics-source">${rows.slice(0,6).map(row=>`<div class="analytics-source-row"><strong>${escapeHTML(row.name)}</strong><div class="analytics-source-track"><div class="analytics-source-fill" style="width:${Math.max(3,row.share*100).toFixed(1)}%"></div></div><em>${money(row.value)} · ${Math.round(row.share*100)}%</em></div>`).join("")}</div>`;
  }

  root.renderAnalytics=function(){
    previous();
    const grid=document.querySelector('.arise-analytics .analytics-grid');
    if(!grid)return;
    const profile=activeProfile();
    const month=ui.getSelectedMonth()||activeMonth;
    const expenses=analytics.expenseComposition(profile,{month});
    const life=analytics.lifetime(profile);
    grid.insertAdjacentHTML('beforeend',`
      <section class="analytics-card half" data-analytics-expense-composition><div class="analytics-section-title"><div><div class="analytics-label">Структура расходов</div><h2>На что ушли деньги</h2></div><span>${expenses.length} групп</span></div>${bars(expenses)}</section>
      <section class="analytics-card half" data-analytics-lifetime><div class="analytics-section-title"><div><div class="analytics-label">Вся история</div><h2>Средний финансовый месяц</h2></div><span>${life.months} мес.</span></div><div class="stats" style="margin-top:15px"><div class="stat"><div class="stat-label">СРЕДНИЙ ДОХОД</div><div class="stat-value">${money(life.averageMonthlyIncome)}</div></div><div class="stat"><div class="stat-label">СРЕДНИЙ РАСХОД</div><div class="stat-value">${money(life.averageMonthlyExpenses)}</div></div><div class="stat"><div class="stat-label">МАКС. ПОСТУПЛЕНИЕ</div><div class="stat-value">${money(life.maxIncome)}</div></div><div class="stat"><div class="stat-label">ПОСТУПЛЕНИЙ</div><div class="stat-value">${life.incomeTransactions}</div></div></div></section>`);
  };
})(typeof globalThis!=="undefined"?globalThis:window);
