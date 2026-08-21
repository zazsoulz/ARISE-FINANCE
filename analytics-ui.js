(function(root){
  "use strict";

  const analytics=root.ARISE_ANALYTICS;
  const core=root.ARISE_FINANCE_CORE;
  if(!analytics||!core)return;

  const oldRenderNav=root.renderNav;
  const safe=v=>Math.max(0,Number(v)||0);
  const pct=(v,total)=>total>0?Math.round(safe(v)/safe(total)*100):0;
  const fmtPct=value=>value==null?"—":`${Math.abs(value).toLocaleString("ru-RU",{maximumFractionDigits:0})}%`;
  let selectedAnalyticsMonth=null;

  function monthLabel(key){try{return formatMonth(key);}catch(_){return key;}}
  function deltaBadge(item,{inverse=false}={}){
    if(!item)return "";
    const value=Number(item.difference)||0;
    if(value===0)return `<span class="analytics-delta neutral">без изменений</span>`;
    const positive=inverse?value<0:value>0;
    return `<span class="analytics-delta ${positive?"up":"down"}" title="К прошлому месяцу">${value>0?"↑":"↓"} ${fmtPct(item.percent)}</span>`;
  }
  function path(values,width=720,height=200,pad=20,maxScale=null){
    if(!values.length)return "";
    const max=Math.max(1,maxScale==null?Math.max(...values.map(safe)):safe(maxScale));
    const points=values.map((value,index)=>{
      const x=values.length===1?width/2:pad+index*((width-pad*2)/(values.length-1));
      const y=height-pad-(safe(value)/max)*(height-pad*2);
      return [x,y];
    });
    return points.map((p,index)=>`${index?"L":"M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  }
  function area(values,width=720,height=200,pad=20,maxScale=null){
    const line=path(values,width,height,pad,maxScale);
    return line?`${line} L${width-pad} ${height-pad} L${pad} ${height-pad} Z`:"";
  }
  function dots(values,klass,width=720,height=200,pad=20,maxScale=null){
    if(!values.length)return "";
    const max=Math.max(1,maxScale==null?Math.max(...values.map(safe)):safe(maxScale));
    return values.map((value,index)=>{
      const x=values.length===1?width/2:pad+index*((width-pad*2)/(values.length-1));
      const y=height-pad-(safe(value)/max)*(height-pad*2);
      return `<circle class="${klass}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6"><title>${money(value)}</title></circle>`;
    }).join("");
  }
  function averageExpenseRunway(profile){
    const rows=analytics.series(profile,4).filter(row=>row.expenses>0);
    if(!rows.length)return {monthly:0,months:null};
    const chosen=rows.slice(-3);
    const monthly=chosen.reduce((sum,row)=>sum+row.expenses,0)/chosen.length;
    const balance=core.reserveBalance(profile);
    return {monthly,months:monthly>0?balance/monthly:null};
  }
  function goalRows(profile){
    const rows=analytics.goals(profile,new Date()).filter(goal=>goal.status!=="completed").slice(0,5);
    if(!rows.length)return `<div class="analytics-empty">Активных целей пока нет.</div>`;
    return rows.map(goal=>{
      const progress=goal.target>0?Math.min(100,Math.round(goal.balance/goal.target*100)):0;
      const projection=goal.projection||{};
      const forecast=projection.remaining<=0?"достигнута":Number.isFinite(projection.months)?`≈ ${projection.months} мес. до цели`:"нужен темп пополнения";
      return `<div class="analytics-goal"><div class="analytics-goal-ring" style="--p:${progress}"><span>${progress}%</span></div><div><strong>${escapeHTML(goal.name||"Цель")}</strong><small>${goal.deadline?`до ${formatDate(goal.deadline)} · `:""}${escapeHTML(forecast)}</small></div><b>${money(goal.balance)}</b></div>`;
    }).join("");
  }
  function sourceRows(profile,month){
    const rows=analytics.incomeSources(profile,{month});
    if(!rows.length)return `<div class="analytics-empty">В этом месяце ещё нет доходов.</div>`;
    return `<div class="analytics-source">${rows.slice(0,6).map(row=>`<div class="analytics-source-row"><strong>${escapeHTML(row.name)}</strong><div class="analytics-source-track"><div class="analytics-source-fill" style="width:${Math.max(3,row.share*100).toFixed(1)}%"></div></div><em>${money(row.value)} · ${Math.round(row.share*100)}%</em></div>`).join("")}</div>`;
  }

  root.renderNav=function(){
    const base=typeof oldRenderNav==="function"?oldRenderNav():"";
    if(base&&base.includes('data-page="analytics"'))return base;
    const items=[["home","Главная"],["income","Распределение"],["goals","Цели"],["history","История"],["analytics","Аналитика"]];
    return `<nav class="nav" aria-label="Основная навигация">${items.map(([id,label])=>`<button class="${activePage===id?"active":""}" data-page="${id}">${label}</button>`).join("")}</nav>`;
  };

  root.renderAnalytics=function(){
    const profile=activeProfile();
    const months=analytics.months(profile);
    if(!selectedAnalyticsMonth||!months.includes(selectedAnalyticsMonth)){
      selectedAnalyticsMonth=months.includes(activeMonth)?activeMonth:(months[months.length-1]||activeMonth);
    }
    const currentMonth=selectedAnalyticsMonth;
    const currentIndex=months.indexOf(currentMonth);
    const previousMonth=currentIndex>0?months[currentIndex-1]:null;
    const current=analytics.monthly(profile,currentMonth);
    const comparison=previousMonth?analytics.compare(profile,currentMonth,previousMonth):null;
    const series=analytics.series(profile,999).filter(row=>row.month<=currentMonth).slice(-6);
    const incomes=series.map(row=>row.income),expenses=series.map(row=>row.expenses);
    const pulseMax=Math.max(1,...incomes.map(safe),...expenses.map(safe));
    const runway=averageExpenseRunway(profile);
    const reserveBalance=core.reserveBalance(profile);
    const reserveTarget=safe(profile.settings&&profile.settings.reserve&&profile.settings.reserve.target);
    const reserveProgress=reserveTarget>0?Math.min(100,Math.round(reserveBalance/reserveTarget*100)):0;
    const page=document.getElementById("page");
    page.className="arise-v3-secondary";
    page.innerHTML=`<main class="arise-analytics">
      <header class="analytics-head"><div><div class="v3-eyebrow">Финансовая аналитика</div><h1>${money(current.income)}</h1><p>Доход за ${escapeHTML(monthLabel(currentMonth))} · все показатели рассчитаны из реальных операций</p></div><select class="analytics-month-select" id="analyticsMonth">${(months.length?months:[activeMonth]).slice().reverse().map(key=>`<option value="${key}" ${key===currentMonth?"selected":""}>${escapeHTML(monthLabel(key))}</option>`).join("")}</select></header>
      <div class="analytics-grid">
        <section class="analytics-card analytics-kpi third kpi-income" style="--i:0"><div class="analytics-kpi-aura" aria-hidden="true"></div><div class="analytics-label">Доход</div><div class="analytics-value">${money(current.income)}</div>${comparison?deltaBadge(comparison.income):`<span class="analytics-delta neutral">первый месяц данных</span>`}<div class="analytics-kpi-rail" aria-hidden="true"><i></i></div></section>
        <section class="analytics-card analytics-kpi third kpi-expense" style="--i:1"><div class="analytics-kpi-aura" aria-hidden="true"></div><div class="analytics-label">Расходы</div><div class="analytics-value">${money(current.expenses)}</div>${comparison?deltaBadge(comparison.expenses,{inverse:true}):`<span class="analytics-delta neutral">первый месяц данных</span>`}<div class="analytics-kpi-rail" aria-hidden="true"><i></i></div></section>
        <section class="analytics-card analytics-kpi third kpi-free" style="--i:2"><div class="analytics-kpi-aura" aria-hidden="true"></div><div class="analytics-label">Не распределено</div><div class="analytics-value">${money(current.freeEnd)}</div>${comparison?deltaBadge(comparison.free):`<span class="analytics-delta neutral">остаток месяца</span>`}<div class="analytics-kpi-rail" aria-hidden="true"><i></i></div></section>

        <section class="analytics-card analytics-pulse-card" style="--i:3"><div class="analytics-section-title"><div><div class="analytics-label">Financial pulse</div><h2>Доход и расходы по месяцам</h2></div><span>${series.length} мес.</span></div>
          <div class="analytics-pulse"><svg viewBox="0 0 720 200" preserveAspectRatio="none" role="img" aria-label="Динамика доходов и расходов"><defs><linearGradient id="analyticsIncomeArea" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d9b66d" stop-opacity=".22"/><stop offset="1" stop-color="#d9b66d" stop-opacity="0"/></linearGradient><linearGradient id="analyticsExpenseArea" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#9baec8" stop-opacity=".13"/><stop offset="1" stop-color="#9baec8" stop-opacity="0"/></linearGradient><filter id="analyticsPointGlow" x="-400%" y="-400%" width="800%" height="800%"><feGaussianBlur stdDeviation="1.7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><line class="gridline" x1="20" y1="50" x2="700" y2="50"/><line class="gridline" x1="20" y1="100" x2="700" y2="100"/><line class="gridline" x1="20" y1="150" x2="700" y2="150"/><path class="analytics-area income-area" d="${area(incomes,720,200,20,pulseMax)}"/><path class="analytics-area expense-area" d="${area(expenses,720,200,20,pulseMax)}"/><path class="income" pathLength="1" d="${path(incomes,720,200,20,pulseMax)}"/><path class="expense" pathLength="1" d="${path(expenses,720,200,20,pulseMax)}"/><g filter="url(#analyticsPointGlow)">${dots(incomes,"point-income",720,200,20,pulseMax)}${dots(expenses,"point-expense",720,200,20,pulseMax)}</g></svg></div>
          <div class="analytics-month-labels" style="--months:${Math.max(1,series.length)}">${series.map(row=>`<span>${escapeHTML(monthLabel(row.month).slice(0,3))}</span>`).join("")}</div><div class="pulse-legend"><span>Доход</span><span>Расходы</span></div>
        </section>

        <section class="analytics-card half" style="--i:4"><div class="analytics-section-title"><div><div class="analytics-label">Источники</div><h2>Откуда пришли деньги</h2></div><span>${current.incomeCount} поступл.</span></div>${sourceRows(profile,currentMonth)}</section>
        <section class="analytics-card half" style="--i:5"><div class="analytics-section-title"><div><div class="analytics-label">Контроль</div><h2>Расходы вне плана</h2></div><span>${pct(current.uncontrolled,current.expenses)}%</span></div><div class="analytics-value ${current.uncontrolled>0?"negative":"positive"}">${money(current.uncontrolled)}</div>${current.uncontrolled>0?`<div class="analytics-alert">Эта сумма не была покрыта категориями или нераспределённым остатком. ARISE не скрывает её внутри обычных расходов.</div>`:`<div class="analytics-note">Все расходы месяца объяснены текущей финансовой моделью.</div>`}</section>

        <section class="analytics-card half" style="--i:6"><div class="analytics-section-title"><div><div class="analytics-label">Цели</div><h2>Темп накопления</h2></div><span>${(profile.goals||[]).filter(g=>g.status!=="completed").length} актив.</span></div>${goalRows(profile)}</section>
        <section class="analytics-card half analytics-reserve-card" style="--i:7"><div class="analytics-section-title"><div><div class="analytics-label">Резерв</div><h2>Финансовая защита</h2></div><span>${reserveTarget?`${reserveProgress}% цели`:"без цели"}</span></div><div class="analytics-reserve-orbit" style="--p:${reserveTarget?reserveProgress:Math.min(100,runway.months?runway.months/6*100:0)}"><i class="analytics-reserve-satellite" aria-hidden="true"></i><div class="analytics-reserve-center"><strong>${money(reserveBalance)}</strong><span>${runway.months==null?"нужны данные о расходах":`≈ ${runway.months.toLocaleString("ru-RU",{maximumFractionDigits:1})} мес. жизни`}</span></div></div><div class="analytics-note">${runway.monthly?`Оценка основана на среднем расходе ${money(runway.monthly)}/мес. за последние месяцы с расходами.`:"После появления истории расходов ARISE рассчитает, на сколько хватит подушки без новых доходов."}</div></section>
      </div>
    </main>`;
    const select=document.getElementById("analyticsMonth");
    if(select)select.onchange=()=>{selectedAnalyticsMonth=select.value;root.renderAnalytics();};
  };

  root.ARISE_ANALYTICS_UI={deltaBadge,path,area,dots,averageExpenseRunway,getSelectedMonth:()=>selectedAnalyticsMonth};
})(typeof globalThis!=="undefined"?globalThis:window);

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

(function(root){
  "use strict";

  const analytics=root.ARISE_ANALYTICS;
  const ui=root.ARISE_ANALYTICS_UI;
  const previous=root.renderAnalytics;
  if(!analytics||!ui||typeof previous!=="function")return;

  function expenseBars(rows){
    if(!rows.length)return `<div class="analytics-empty">Расходов в этом месяце пока нет.</div>`;
    return `<div class="analytics-source">${rows.slice(0,6).map(row=>`<div class="analytics-source-row"><strong>${escapeHTML(row.name)}</strong><div class="analytics-source-track"><div class="analytics-source-fill" style="width:${Math.max(3,row.share*100).toFixed(1)}%"></div></div><em>${money(row.value)} · ${Math.round(row.share*100)}%</em></div>`).join("")}</div>`;
  }

  function enhanceExpenseAnalytics(){
    previous();
    const grid=document.querySelector('.arise-analytics .analytics-grid');
    if(!grid)return;
    const profile=activeProfile();
    const month=ui.getSelectedMonth()||activeMonth;
    const expenses=analytics.expenseComposition(profile,{month});
    const life=analytics.lifetime(profile);
    grid.insertAdjacentHTML('beforeend',`
      <section class="analytics-card half" data-analytics-expense-composition><div class="analytics-section-title"><div><div class="analytics-label">Структура расходов</div><h2>На что ушли деньги</h2></div><span>${expenses.length} групп</span></div>${expenseBars(expenses)}</section>
      <section class="analytics-card half" data-analytics-lifetime><div class="analytics-section-title"><div><div class="analytics-label">Вся история</div><h2>Средний финансовый месяц</h2></div><span>${life.months} мес.</span></div><div class="stats" style="margin-top:15px"><div class="stat"><div class="stat-label">СРЕДНИЙ ДОХОД</div><div class="stat-value">${money(life.averageMonthlyIncome)}</div></div><div class="stat"><div class="stat-label">СРЕДНИЙ РАСХОД</div><div class="stat-value">${money(life.averageMonthlyExpenses)}</div></div><div class="stat"><div class="stat-label">МАКС. ПОСТУПЛЕНИЕ</div><div class="stat-value">${money(life.maxIncome)}</div></div><div class="stat"><div class="stat-label">ПОСТУПЛЕНИЙ</div><div class="stat-value">${life.incomeTransactions}</div></div></div></section>`);
  }

  root.renderAnalytics=enhanceExpenseAnalytics;
  root.ARISE_ANALYTICS_EXPENSE_UI={expenseBars,enhanceExpenseAnalytics};
})(typeof globalThis!=="undefined"?globalThis:window);

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

(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  const reserveAnalytics=root.ARISE_RESERVE_ANALYTICS;
  const essential=root.ARISE_RESERVE_ESSENTIAL_SPEND;
  if(!core||!reserveAnalytics||!essential)return;

  const previousRenderAnalytics=root.renderAnalytics;
  if(typeof previousRenderAnalytics!=="function")return;

  const safe=value=>Math.max(0,Math.round(Number(value)||0));

  function reserveSettings(profile){
    return profile&&profile.settings&&profile.settings.reserve||{};
  }

  function reserveTarget(profile){
    const settings=reserveSettings(profile);
    return safe(settings.targetBalance||settings.target||0);
  }

  function runwayModel(profile){
    const settings=reserveSettings(profile);
    const configured=safe(settings.monthlyEssentialSpend);
    const categoryIds=essential.normalizeIds(settings.essentialCategoryIds||[]);
    const categoryModel=essential.averageEssentialSpend(profile,{categoryIds,months:3});
    const monthly=configured||categoryModel.monthlyAverage||0;
    const model=reserveAnalytics.reserveRunway({
      reserveBalance:core.reserveBalance(profile),
      monthlyEssentialSpend:monthly
    });

    return {
      ...model,
      source:configured?"configured":categoryModel.status==="ok"&&monthly>0?"essential_categories":"none",
      categoryEstimate:categoryModel.monthlyAverage||0,
      categoryModel
    };
  }

  function reserveCard(){
    return [...document.querySelectorAll(".analytics-card")].find(card=>
      [...card.querySelectorAll(".analytics-label")].some(label=>label.textContent.trim()==="Резерв")
    )||null;
  }

  function applyReserveAnalyticsModel(profile){
    const card=reserveCard();
    if(!card)return;

    const balance=safe(core.reserveBalance(profile));
    const target=reserveTarget(profile);
    const progress=reserveAnalytics.reserveProgress({reserveBalance:balance,targetBalance:target});
    const runway=runwayModel(profile);
    const months=runway.status==="ok"?runway.months:null;

    const headline=card.querySelector(".analytics-section-title > span");
    if(headline){
      headline.textContent=target>0?`${Math.round(progress.percent||0)}% цели`:"без цели";
    }

    const orbit=card.querySelector(".analytics-reserve-orbit");
    if(orbit){
      const orbitProgress=target>0
        ?Math.min(100,Math.round(progress.percent||0))
        :Math.min(100,months?months/6*100:0);
      orbit.style.setProperty("--p",String(orbitProgress));
    }

    const runwayText=card.querySelector(".analytics-reserve-center span");
    if(runwayText){
      runwayText.textContent=months==null
        ?"нужны обязательные расходы"
        :`≈ ${months.toLocaleString("ru-RU",{maximumFractionDigits:1})} мес. защиты`;
    }

    const note=card.querySelector(".analytics-note");
    if(note){
      if(runway.source==="configured"){
        note.textContent=`Runway рассчитан по заданным обязательным расходам ${money(runway.monthlyEssentialSpend)}/мес.`;
      }else if(runway.source==="essential_categories"){
        note.textContent=`Runway рассчитан по среднему факту выбранных обязательных категорий: ${money(runway.categoryEstimate)}/мес.`;
      }else if((reserveSettings(profile).essentialCategoryIds||[]).length){
        note.textContent="По выбранным обязательным категориям пока недостаточно истории для расчёта runway.";
      }else{
        note.textContent="Выбери обязательные категории или задай месячную сумму в настройках подушки. ARISE не считает все расходы обязательными автоматически.";
      }
    }
  }

  root.renderAnalytics=function(){
    const result=previousRenderAnalytics();
    applyReserveAnalyticsModel(activeProfile());
    return result;
  };

  root.ARISE_ANALYTICS_RESERVE_RUNWAY={reserveTarget,runwayModel,applyReserveAnalyticsModel};
})(typeof globalThis!=="undefined"?globalThis:window);
