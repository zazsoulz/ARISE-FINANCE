(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  const safeAmount=value=>Math.max(0,Math.round(Number(value)||0));
  const sum=values=>values.reduce((total,value)=>total+safeAmount(value),0);
  const pct=(value,total)=>total>0?Math.round(safeAmount(value)/safeAmount(total)*100):0;
  const currentProfile=()=>activeProfile();

  function groupMonth(profile,month){
    const raw=core.monthStats(profile,month);
    const byId=new Map((profile.categories||[]).map(item=>[String(item.id),item]));
    let fixed=0;
    let categories=0;
    for(const [id,value] of Object.entries(raw.categoryAllocated||{})){
      const category=byId.get(String(id));
      if(category&&category.type==="fixed") fixed+=safeAmount(value);
      else categories+=safeAmount(value);
    }
    return {income:safeAmount(raw.income),expenses:safeAmount(raw.expenses),fixed,categories,reserve:safeAmount(raw.reserve),goals:sum(Object.values(raw.goalAllocated||{})),unallocated:safeAmount(raw.free),uncontrolled:safeAmount(raw.uncontrolled)};
  }

  function node({side,kind,name,amount,total,color,page}){
    return `<button class="arise-flow-node ${side} ${kind}" style="--node-color:${color}" data-v3-page="${page}"><span class="node-name">${escapeHTML(name)}</span><strong>${money(amount)}</strong><small>${pct(amount,total)}%</small></button>`;
  }

  function bindPageLinks(scope=document){
    scope.querySelectorAll("[data-v3-page]").forEach(button=>{button.onclick=()=>{activePage=button.dataset.v3Page;render();};});
  }

  function categoryRuleMeta(category){
    const priority=safeAmount(category?.priority)||1;
    if(category?.type==="fixed"){
      return `до ${money(category.fixedAmount||0)} в месяц · приоритет ${priority}`;
    }
    const percent=safeAmount(category?.percent);
    const limit=category?.limit!==null&&category?.limit!==""&&typeof category?.limit!=="undefined"?safeAmount(category.limit):null;
    return limit===null
      ? `${percent}% с каждого пополнения · без лимита · приоритет ${priority}`
      : `${percent}% с каждого пополнения · лимит ${money(limit)}/мес. · приоритет ${priority}`;
  }

  function goalPace(profile,goal){
    if(!goal.deadline) return {text:`без срока · приоритет ${safeAmount(goal.priority)||1}`,warning:false};
    const status=core.goalDeadlineStatus(profile,goal,`${activeMonth}-01`);
    const base=`до ${formatDate(goal.deadline)} · нужно ${money(status.requiredMonthly)}/мес.`;
    if(status.onTrack) return {text:`${base} · текущий план укладывается`,warning:false};
    return {text:`${base} · по текущему плану не хватает ${money(status.shortfall)}/мес.`,warning:true};
  }

  root.renderTopbar=function(){
    const account=state.account;
    const letter=(account.name||"П").trim().slice(0,1).toUpperCase();
    return `<header class="topbar"><div class="logo">ARISE <span>FINANCE</span></div><div class="user"><button class="avatar" data-page="settings" aria-label="Настройки профиля">${account.avatar?`<img src="${escapeHTML(account.avatar)}" alt="">`:escapeHTML(letter)}</button></div></header>`;
  };

  root.renderNav=function(){
    const items=[["home","Главная"],["income","Распределение"],["goals","Цели"],["history","История"]];
    return `<nav class="nav" aria-label="Основная навигация">${items.map(([id,label])=>`<button class="${activePage===id?"active":""}" data-page="${id}">${label}</button>`).join("")}</nav>`;
  };

  root.renderHome=function(){
    const profile=currentProfile();
    const data=groupMonth(profile,activeMonth);
    const page=document.getElementById("page");
    page.className="";
    page.innerHTML=`<main class="arise-v3-home" aria-label="Финансовый поток за ${escapeHTML(formatMonth(activeMonth))}">
      <div class="arise-v3-month">${escapeHTML(formatMonth(activeMonth))}</div>
      <section class="arise-v3-income"><div class="arise-v3-income-label">Доход в месяце</div><div class="arise-v3-income-value">${money(data.income)}</div><div class="arise-v3-income-note">поступило</div></section>
      <section class="arise-flow-stage" aria-label="Распределение дохода">
        <div class="arise-flow-source" aria-hidden="true"></div>
        <svg class="arise-flow-svg" viewBox="0 0 600 570" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ariseTrunk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eee6d6" stop-opacity=".88"/><stop offset=".46" stop-color="#b7b4aa" stop-opacity=".64"/><stop offset="1" stop-color="#c6a86b" stop-opacity=".62"/></linearGradient></defs><path class="arise-flow-ghost" d="M300 18 C285 92 316 154 292 226 C266 302 284 373 300 480"/><path class="arise-flow-ghost" d="M300 18 C321 99 282 164 309 244 C335 322 315 394 300 480"/><path class="arise-flow-main" d="M300 18 C304 104 295 170 300 248 C305 334 292 411 300 480"/><path class="arise-flow-main" d="M295 18 C286 118 315 184 291 276 C273 347 291 415 300 480" opacity=".42"/><path class="arise-flow-main" d="M305 18 C319 112 286 189 311 275 C330 347 311 416 300 480" opacity=".36"/><path class="arise-flow-branch" style="--branch:#c6a86b" d="M300 88 C249 92 211 101 172 112"/><path class="arise-flow-drift" style="--branch:#c6a86b" d="M300 88 C249 92 211 101 172 112"/><path class="arise-flow-branch" style="--branch:#c8b37f" d="M302 158 C358 157 394 165 430 180"/><path class="arise-flow-drift" style="--branch:#c8b37f" d="M302 158 C358 157 394 165 430 180"/><path class="arise-flow-branch" style="--branch:#9db6b4" d="M296 278 C246 280 208 292 171 306"/><path class="arise-flow-drift" style="--branch:#9db6b4" d="M296 278 C246 280 208 292 171 306"/><path class="arise-flow-branch" style="--branch:#c6a86b" d="M303 352 C357 350 394 356 430 372"/><path class="arise-flow-drift" style="--branch:#c6a86b" d="M303 352 C357 350 394 356 430 372"/></svg>
        ${node({side:"left",kind:"fixed",name:"Обязательное",amount:data.fixed,total:data.income,color:"#bda46f",page:"income"})}
        ${node({side:"right",kind:"categories",name:"Категории",amount:data.categories,total:data.income,color:"#c6ae78",page:"income"})}
        ${node({side:"left",kind:"reserve",name:"Резерв",amount:data.reserve,total:data.income,color:"#9eb9b7",page:"settings"})}
        ${node({side:"right",kind:"goals",name:"Цели",amount:data.goals,total:data.income,color:"#c4a261",page:"goals"})}
        <div class="arise-remainder"><div class="arise-remainder-label">Не распределено</div><div class="arise-remainder-value">${money(data.unallocated)}</div><div class="arise-remainder-note">остаток сохраняется и переносится дальше</div></div>
      </section>
      ${data.uncontrolled>0?`<div class="v3-alert"><strong>${money(data.uncontrolled)} не объяснены системой</strong><span>ARISE покажет разбивку расходов и источник недостающих денег в истории.</span></div>`:""}
      <button class="arise-v3-cta" id="homeIncome" data-v3-page="income"><span>${data.unallocated>0?"Посмотреть распределение":"Изменить распределение"}</span><span>→</span></button>
    </main>`;
    bindPageLinks(page);
  };

  root.renderIncome=function(){
    const profile=currentProfile();
    const data=groupMonth(profile,activeMonth);
    const raw=core.monthStats(profile,activeMonth);
    const rows=(profile.categories||[]).filter(c=>c.enabled!==false).map(category=>({category,amount:safeAmount(raw.categoryAllocated?.[category.id]||0)})).sort((a,b)=>safeAmount(b.category.priority)-safeAmount(a.category.priority));
    const page=document.getElementById("page");
    page.className="arise-v3-secondary arise-v3-distribution";
    page.innerHTML=`<div class="v3-page-head"><div><div class="v3-eyebrow">Распределение</div><h1>${money(data.income)}</h1><p>${escapeHTML(formatMonth(activeMonth))} · текущая картина</p></div><button class="v3-round" id="incomeStart" aria-label="Добавить доход">+</button></div>
      <section class="v3-flow-summary"><div class="v3-mini-source"></div><div class="v3-summary-row"><span>Обязательное</span><strong>${money(data.fixed)}</strong><em>${pct(data.fixed,data.income)}%</em></div><div class="v3-summary-row"><span>Категории</span><strong>${money(data.categories)}</strong><em>${pct(data.categories,data.income)}%</em></div><div class="v3-summary-row cool"><span>Резерв</span><strong>${money(data.reserve)}</strong><em>${pct(data.reserve,data.income)}%</em></div><div class="v3-summary-row"><span>Цели</span><strong>${money(data.goals)}</strong><em>${pct(data.goals,data.income)}%</em></div><div class="v3-summary-tail"><span>Не распределено</span><strong>${money(data.unallocated)}</strong></div></section>
      <section class="v3-section"><div class="v3-section-title"><span>Правила месяца</span><button id="incomeSettings">Настроить</button></div><div class="v3-rule-list">${rows.length?rows.map(row=>`<div class="v3-rule"><div><strong>${escapeHTML(row.category.name||"Категория")}</strong><span>${escapeHTML(categoryRuleMeta(row.category))}</span></div><b>${money(row.amount)}</b></div>`).join(""):`<div class="v3-empty">Категорий нет. Создай свои правила распределения.</div>`}</div></section>
      <section class="v3-section v3-soft-note"><span>Как работает процент</span><p>Если месячный лимит не указан, выбранный процент распределяется с каждого нового пополнения в рамках месяца. Например, 10% означает 10% с каждого внесённого дохода. Все предложения видны до сохранения.</p></section>`;
    document.getElementById("incomeStart").onclick=showIncomeModal;
    document.getElementById("incomeSettings").onclick=()=>{activePage="settings";render();};
  };

  root.renderGoals=function(){
    const profile=currentProfile();
    const active=(profile.goals||[]).filter(goal=>goal.status!=="completed").sort((a,b)=>safeAmount(b.priority)-safeAmount(a.priority));
    const completed=(profile.goals||[]).filter(goal=>goal.status==="completed");
    const total=active.reduce((s,goal)=>s+safeAmount(core.goalBalance(profile,goal)),0);
    const page=document.getElementById("page");
    page.className="arise-v3-secondary arise-v3-goals";
    page.innerHTML=`<div class="v3-page-head"><div><div class="v3-eyebrow">Все цели</div><h1>${money(total)}</h1><p>${active.length} ${active.length===1?"активная цель":"активных целей"}</p></div><button class="v3-round" id="createGoal" aria-label="Создать цель">+</button></div>
      <section class="v3-goal-list">${active.length?active.map(goal=>{const balance=safeAmount(core.goalBalance(profile,goal));const target=safeAmount(goal.target);const progress=target?Math.min(100,Math.round(balance/target*100)):0;const pace=goalPace(profile,goal);return `<article class="v3-goal" data-goal-id="${goal.id}"><div class="v3-goal-ring" style="--p:${progress}"><span>${progress}%</span></div><div class="v3-goal-main"><strong>${escapeHTML(goal.name||"Цель")}</strong><div>${money(balance)} <span>из ${money(target)}</span></div><small class="${pace.warning?"v3-warning":""}">${escapeHTML(pace.text)}</small></div><div class="v3-goal-actions"><button data-goal-fund="${goal.id}">Пополнить</button><button data-goal-edit="${goal.id}" aria-label="Изменить цель">•••</button></div></article>`;}).join(""):`<div class="v3-empty">Пока нет целей. Создай первую — ARISE покажет, какой темп нужен для выбранного срока.</div>`}</section>
      ${completed.length?`<section class="v3-section"><div class="v3-section-title"><span>Достигнутые</span><b>${completed.length}</b></div>${completed.map(goal=>`<div class="v3-rule"><div><strong>${escapeHTML(goal.name)}</strong><span>цель достигнута</span></div><b>${money(goal.target)}</b></div>`).join("")}</section>`:""}`;
    document.getElementById("createGoal").onclick=()=>showGoalModal();
    page.querySelectorAll("[data-goal-fund]").forEach(button=>button.onclick=()=>showGoalFundModal(button.dataset.goalFund));
    page.querySelectorAll("[data-goal-edit]").forEach(button=>button.onclick=()=>showGoalModal(button.dataset.goalEdit));
  };

  function chartPath(values,width=520,height=180){
    const max=Math.max(1,...values); const min=Math.min(0,...values); const span=Math.max(1,max-min);
    const points=values.map((value,index)=>{const x=values.length===1?width/2:index*(width/(values.length-1));const y=height-((value-min)/span)*(height-28)-14;return [x,y];});
    if(!points.length) return "";
    return points.map((point,index)=>`${index?"L":"M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(" ");
  }

  root.renderHistory=function(){
    const profile=currentProfile();
    const months=allMonths(profile).slice(-6);
    const incomes=months.map(month=>safeAmount(core.monthStats(profile,month).income));
    const data=groupMonth(profile,activeMonth);
    const txs=monthTransactions(profile,activeMonth).slice().reverse().slice(0,14);
    const page=document.getElementById("page");
    page.className="arise-v3-secondary arise-v3-history";
    page.innerHTML=`<div class="v3-page-head"><div><div class="v3-eyebrow">История</div><h1>${escapeHTML(formatMonth(activeMonth))}</h1><p>${money(data.income)} доход · ${money(data.expenses)} расходы</p></div><div class="v3-head-actions"><button id="historyIncome">+ доход</button><button id="historyExpense">− расход</button></div></div>
      ${data.uncontrolled>0?`<div class="v3-alert"><strong>${money(data.uncontrolled)} неконтролируемых средств</strong><span>Это часть расходов, которую нельзя покрыть выбранной категорией и нераспределённым остатком.</span></div>`:""}
      <section class="v3-history-chart"><div class="v3-chart-total"><span>Доход по месяцам</span><strong>${money(incomes[incomes.length-1]||0)}</strong></div><svg viewBox="0 0 520 180" preserveAspectRatio="none" aria-label="Динамика дохода"><path class="v3-chart-glow" d="${chartPath(incomes)}"/><path class="v3-chart-line" d="${chartPath(incomes)}"/></svg><div class="v3-chart-months">${months.map(month=>`<span>${escapeHTML(formatMonth(month).slice(0,3))}</span>`).join("")}</div></section>
      <section class="v3-breakdown">${[["Обязательное",data.fixed],["Категории",data.categories],["Резерв",data.reserve],["Цели",data.goals],["Не распределено",data.unallocated]].map(([name,value],index)=>`<div class="v3-break-row"><i class="tone-${index}"></i><span>${name}</span><strong>${money(value)}</strong><em>${pct(value,data.income)}%</em></div>`).join("")}</section>
      <section class="v3-section"><div class="v3-section-title"><span>Операции месяца</span><b>${txs.length}</b></div><div class="v3-transactions">${txs.length?txs.map(tx=>historyTransaction(tx)).join(""):`<div class="v3-empty">Операций пока нет.</div>`}</div></section>`;
    document.getElementById("historyIncome").onclick=showIncomeModal;
    document.getElementById("historyExpense").onclick=showExpenseModal;
  };

  root.ARISE_V3={groupMonth,chartPath,categoryRuleMeta,goalPace};
})(typeof globalThis!=="undefined"?globalThis:window);
