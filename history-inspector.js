(function(root){
  "use strict";

  const previous=root.renderHistory;
  if(typeof previous!=="function") return;

  const defaults=()=>({scope:"month",type:"all",category:"all",goal:"all",source:"all",currency:"all"});
  const filters=defaults();
  let filterProfile=null;
  const typeLabels={
    income:"Доход",
    expense:"Расход",
    goal_contribution:"Пополнение цели",
    goal_withdrawal:"Вывод из цели",
    reserve_deposit:"Пополнение резерва",
    reserve_withdrawal:"Вывод из резерва"
  };
  const esc=value=>escapeHTML(String(value??""));
  const monthOf=tx=>String(tx&&tx.month||tx&&tx.date||"").slice(0,7);
  const txCurrency=tx=>String(tx&&tx.originalCurrency||tx&&tx.currency||tx&&tx.baseCurrency||activeProfile().settings?.currency||"RUB");
  const txSource=tx=>String(tx&&tx.source||tx&&tx.description||tx&&tx.note||"").trim();
  const txCategories=tx=>{
    const ids=[];
    if(tx&&tx.categoryId) ids.push(String(tx.categoryId));
    for(const item of tx&&tx.allocations||[]) if(item&&item.categoryId) ids.push(String(item.categoryId));
    return [...new Set(ids)];
  };
  const txGoals=tx=>{
    const ids=[];
    if(tx&&tx.goalId) ids.push(String(tx.goalId));
    for(const item of tx&&tx.goalAllocations||[]) if(item&&item.goalId) ids.push(String(item.goalId));
    return [...new Set(ids)];
  };
  const unique=values=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru"));

  function historyTransaction(tx){
    if(tx.type==="income"){
      return `<div class="row"><div class="row-left"><strong class="positive">+ ${money(tx.amount,tx.currency)}</strong><div class="tiny muted">${esc(tx.source||"Источник не указан")} · ${formatDate(tx.date)}</div></div><div class="row-right"><div class="pill">Доход</div></div></div><div class="allocation-grid" style="margin-top:0">${(tx.allocations||[]).map(item=>`<div class="allocation"><div class="allocation-name">${esc(item.name)}</div><div class="allocation-value">${money(item.amount,tx.currency)}</div></div>`).join("")}${tx.reserve?`<div class="allocation"><div class="allocation-name">РЕЗЕРВ</div><div class="allocation-value">${money(tx.reserve,tx.currency)}</div></div>`:""}</div>`;
    }
    return `<div class="row"><div class="row-left"><strong class="negative">- ${money(tx.amount,tx.currency)}</strong><div class="tiny muted">${esc(tx.categoryName)} · ${esc(tx.source||"Без описания")} · ${formatDate(tx.date)}</div></div><div class="row-right"><div class="pill">Расход</div></div></div>`;
  }

  root.historyTransaction=historyTransaction;

  function resetFilters(){Object.assign(filters,defaults());}
  function ensureProfileScope(profile){
    if(filterProfile===null){filterProfile=profile;return false;}
    if(filterProfile!==profile){resetFilters();filterProfile=profile;return true;}
    return false;
  }
  function option(value,label,current){
    return `<option value="${esc(value)}" ${String(current)===String(value)?"selected":""}>${esc(label)}</option>`;
  }

  function relevantTransactions(profile){
    return (profile.transactions||[]).filter(tx=>filters.scope==="all"||monthOf(tx)===activeMonth);
  }

  function filteredTransactions(profile){
    const completed=new Set((profile.goals||[]).filter(goal=>goal.status==="completed").map(goal=>String(goal.id)));
    return relevantTransactions(profile).filter(tx=>{
      if(filters.type!=="all"&&String(tx.type)!==filters.type) return false;
      if(filters.category!=="all"&&!txCategories(tx).includes(filters.category)) return false;
      const goals=txGoals(tx);
      if(filters.goal==="__completed__"&&!goals.some(id=>completed.has(id))) return false;
      if(filters.goal!=="all"&&filters.goal!=="__completed__"&&!goals.includes(filters.goal)) return false;
      if(filters.source!=="all"&&txSource(tx)!==filters.source) return false;
      if(filters.currency!=="all"&&txCurrency(tx)!==filters.currency) return false;
      return true;
    }).slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  }

  function filterPanel(profile){
    const txs=profile.transactions||[];
    const categories=profile.categories||[];
    const goals=profile.goals||[];
    const sources=unique(txs.map(txSource));
    const currencies=unique(txs.map(txCurrency));
    const types=unique(txs.map(tx=>String(tx.type||"")));
    const months=unique(txs.map(monthOf)).reverse();
    return `<details class="history-filter-panel" aria-label="Фильтры истории">
      <summary class="history-filter-summary"><span>Фильтры операций</span><strong>Уточнить выбор</strong><i aria-hidden="true">+</i></summary>
      <div class="history-filter-content">
      <div class="history-filter-head"><div><span>Точный поиск</span><strong>Найти конкретные операции</strong></div><button type="button" data-history-reset>Сбросить</button></div>
      <div class="history-filter-grid">
        <label><span>Период</span><select data-history-filter="scope">${option("month","Выбранный месяц",filters.scope)}${option("all","Вся история",filters.scope)}</select></label>
        <label><span>Месяц</span><select data-history-month ${filters.scope==="all"?"disabled":""}>${months.length?months.map(month=>option(month,formatMonth(month),activeMonth)).join(""):option(activeMonth,formatMonth(activeMonth),activeMonth)}</select></label>
        <label><span>Тип операции</span><select data-history-filter="type">${option("all","Все операции",filters.type)}${types.map(type=>option(type,typeLabels[type]||type,filters.type)).join("")}</select></label>
        <label><span>Категория</span><select data-history-filter="category">${option("all","Все категории",filters.category)}${categories.map(item=>option(String(item.id),item.name||"Категория",filters.category)).join("")}</select></label>
        <label><span>Цель</span><select data-history-filter="goal">${option("all","Все цели",filters.goal)}${goals.some(goal=>goal.status==="completed")?option("__completed__","Достигнутые цели",filters.goal):""}${goals.map(item=>option(String(item.id),item.name||"Цель",filters.goal)).join("")}</select></label>
        <label><span>Источник</span><select data-history-filter="source">${option("all","Все источники",filters.source)}${sources.map(source=>option(source,source,filters.source)).join("")}</select></label>
        <label><span>Валюта</span><select data-history-filter="currency">${option("all","Все валюты",filters.currency)}${currencies.map(currency=>option(currency,currency,filters.currency)).join("")}</select></label>
      </div>
      </div>
    </details>`;
  }

  function transactionAmount(tx){
    const originalCurrency=tx.originalCurrency||tx.currency||tx.baseCurrency||activeProfile().settings?.currency||"RUB";
    const originalAmount=Number.isFinite(Number(tx.originalAmount))?Number(tx.originalAmount):Number(tx.amount)||0;
    const baseCurrency=tx.baseCurrency||activeProfile().settings?.currency||originalCurrency;
    const baseAmount=Number.isFinite(Number(tx.baseAmount))?Number(tx.baseAmount):Number(tx.amount)||0;
    const original=money(originalAmount,originalCurrency);
    return originalCurrency!==baseCurrency?`${original} · ${money(baseAmount,baseCurrency)}`:original;
  }

  function detailRow(label,value){
    if(value===null||typeof value==="undefined"||value==="") return "";
    return `<div class="history-detail-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function inspect(profile,id){
    const tx=(profile.transactions||[]).find(item=>String(item.id)===String(id));
    if(!tx) return;
    const category=(profile.categories||[]).find(item=>String(item.id)===String(tx.categoryId));
    const goal=(profile.goals||[]).find(item=>String(item.id)===String(tx.goalId));
    const allocations=(tx.allocations||[]).map(item=>`${item.name||"Категория"}: ${money(item.amount||0,tx.baseCurrency||profile.settings?.currency)}`).join(" · ");
    const goalAllocations=(tx.goalAllocations||[]).map(item=>`${item.name||"Цель"}: ${money(item.amount||0,tx.baseCurrency||profile.settings?.currency)}`).join(" · ");
    openModal(`<div class="history-detail">
      <div class="kicker">ОПЕРАЦИЯ</div>
      <h2 class="title">${esc(typeLabels[tx.type]||tx.type||"Операция")}</h2>
      <div class="history-detail-amount">${esc(transactionAmount(tx))}</div>
      <div class="history-detail-list">
        ${detailRow("Дата",formatDate(tx.date||""))}
        ${detailRow("Источник",txSource(tx))}
        ${detailRow("Категория",category?.name||tx.categoryName)}
        ${detailRow("Цель",goal?.name||tx.goalName)}
        ${detailRow("Источник денег",tx.fundingSource)}
        ${detailRow("Контролируемая часть",Number.isFinite(Number(tx.controlledAmount))?money(Number(tx.controlledAmount),tx.baseCurrency||profile.settings?.currency):"")}
        ${detailRow("Неконтролируемая часть",Number(tx.uncontrolledAmount)>0?money(Number(tx.uncontrolledAmount),tx.baseCurrency||profile.settings?.currency):"")}
        ${detailRow("Распределение",allocations)}
        ${detailRow("Цели",goalAllocations)}
        ${detailRow("Комментарий",tx.note)}
        ${detailRow("ID",tx.id)}
      </div>
      <div class="actions"><button class="btn" type="button" data-history-close>Закрыть</button></div>
    </div>`);
    document.querySelector("[data-history-close]")?.addEventListener("click",closeModal);
  }

  function renderFilteredList(page,profile){
    const rows=filteredTransactions(profile);
    const list=page.querySelector(".v3-transactions");
    const title=page.querySelector(".v3-section .v3-section-title");
    if(title){
      const label=title.querySelector("span");
      const count=title.querySelector("b");
      if(label) label.textContent=filters.scope==="all"?"Операции за всё время":"Операции месяца";
      if(count) count.textContent=String(rows.length);
    }
    if(!list) return;
    list.innerHTML=rows.length?rows.map(tx=>`<div class="history-inspect-row" data-history-tx="${esc(tx.id)}" role="button" tabindex="0" aria-label="Открыть операцию">${historyTransaction(tx)}</div>`).join(""):`<div class="v3-empty">По выбранным фильтрам операций нет.</div>`;
    list.querySelectorAll("[data-history-tx]").forEach(row=>{
      const open=()=>inspect(profile,row.dataset.historyTx);
      row.addEventListener("click",open);
      row.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();open();}});
    });
  }

  function bind(page,profile){
    page.querySelectorAll("[data-history-filter]").forEach(select=>select.addEventListener("change",()=>{
      filters[select.dataset.historyFilter]=select.value;
      root.renderHistory();
    }));
    page.querySelector("[data-history-month]")?.addEventListener("change",event=>{
      activeMonth=event.target.value;
      root.renderHistory();
    });
    page.querySelector("[data-history-reset]")?.addEventListener("click",()=>{
      resetFilters();
      root.renderHistory();
    });
  }

  root.renderHistory=function(){
    const profile=activeProfile();
    ensureProfileScope(profile);
    previous();
    const page=document.getElementById("page");
    const operations=page.querySelector(".v3-section");
    if(!operations) return;
    operations.insertAdjacentHTML("beforebegin",filterPanel(profile));
    renderFilteredList(page,profile);
    bind(page,profile);
  };

  root.ARISE_HISTORY_INSPECTOR={filteredTransactions,reset:resetFilters,state:filters,ensureProfileScope,historyTransaction};
})(typeof globalThis!=="undefined"?globalThis:window);
