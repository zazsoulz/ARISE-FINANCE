(function(root){
  "use strict";

  const analytics=root.ARISE_ANALYTICS;
  const previousRender=root.renderAnalytics;
  if(!analytics||typeof previousRender!=="function")return;

  function selectedMonth(){
    const ui=root.ARISE_ANALYTICS_UI;
    return ui&&typeof ui.getSelectedMonth==="function"?ui.getSelectedMonth():root.activeMonth;
  }

  function enhanceAnalyticsChart(){
    const document=root.document;
    if(!document)return;
    const pulse=document.querySelector(".analytics-pulse");
    if(!pulse||pulse.parentElement.querySelector(".analytics-chart-details"))return;

    const profile=root.activeProfile();
    const month=selectedMonth();
    const series=analytics.series(profile,999).filter(row=>row.month<=month).slice(-6);
    if(!series.length)return;

    const details=document.createElement("details");
    details.className="analytics-chart-details";
    details.innerHTML=`
      <summary>Данные графика</summary>
      <div class="analytics-chart-table-wrap">
        <table class="analytics-chart-table">
          <caption>Доход и расходы по месяцам</caption>
          <thead><tr><th scope="col">Месяц</th><th scope="col">Доход</th><th scope="col">Расходы</th></tr></thead>
          <tbody>${series.map(row=>`<tr><th scope="row">${root.escapeHTML(root.formatMonth(row.month))}</th><td>${root.money(row.income)}</td><td>${root.money(row.expenses)}</td></tr>`).join("")}</tbody>
        </table>
      </div>`;
    pulse.parentElement.appendChild(details);
  }

  root.renderAnalytics=function(){
    previousRender();
    enhanceAnalyticsChart();
  };

  root.ARISE_ANALYTICS_CHART_ACCESSIBILITY={enhanceAnalyticsChart};
})(typeof globalThis!=="undefined"?globalThis:window);
