(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  const analytics=root.ARISE_RESERVE_ANALYTICS;
  const essential=root.ARISE_RESERVE_ESSENTIAL_SPEND;
  if(!core||!analytics||!essential)return;

  const previousRenderSettings=root.renderSettings;
  const previousHistoryTransaction=root.historyTransaction;
  const safe=value=>Math.max(0,Math.round(Number(value)||0));
  const reserveTypes=new Set(["reserve_deposit","reserve_withdrawal"]);
  const esc=value=>escapeHTML(String(value??""));

  function reserveSettings(profile){
    profile.settings=profile.settings||{};
    profile.settings.reserve=profile.settings.reserve||{};
    return profile.settings.reserve;
  }

  function selectedEssentialCategoryIds(profile){
    return essential.normalizeIds(reserveSettings(profile).essentialCategoryIds||[]);
  }

  function categorySpendModel(profile,count=3){
    const months=typeof allMonths==="function"?allMonths(profile).slice(-count):[];
    return essential.averageEssentialSpend(profile,{
      categoryIds:selectedEssentialCategoryIds(profile),
      monthKeys:months,
      months:count
    });
  }

  function runwayModel(profile){
    const settings=reserveSettings(profile);
    const configured=safe(settings.monthlyEssentialSpend);
    const categoryModel=categorySpendModel(profile,3);
    const monthly=configured||categoryModel.monthlyAverage||0;
    const model=analytics.reserveRunway({reserveBalance:core.reserveBalance(profile),monthlyEssentialSpend:monthly});
    return {
      ...model,
      source:configured?"configured":categoryModel.status==="ok"&&monthly>0?"essential_categories":"none",
      categoryEstimate:categoryModel.monthlyAverage||0,
      categoryModel
    };
  }

  function reserveTarget(profile){return safe(reserveSettings(profile).targetBalance||reserveSettings(profile).target||0);}

  function essentialCategoryOptions(profile){
    const selected=new Set(selectedEssentialCategoryIds(profile));
    const categories=(profile.categories||[]).filter(category=>category&&category.id!=null);
    if(!categories.length)return `<div class="tiny muted">Сначала создай категории расходов. ARISE не будет угадывать обязательные расходы автоматически.</div>`;
    return `<div style="display:grid;gap:8px;margin-top:8px">${categories.map(category=>`
      <label style="display:flex;align-items:center;gap:9px;cursor:pointer">
        <input class="reserve-essential-category" type="checkbox" value="${escapeHTML(String(category.id))}" ${selected.has(String(category.id))?"checked":""} style="width:auto">
        <span>${escapeHTML(category.name||"Без названия")}</span>
      </label>`).join("")}</div>`;
  }

  function reserveTransactions(profile){
    return (profile.transactions||[])
      .filter(tx=>reserveTypes.has(tx&&tx.type))
      .slice()
      .reverse()
      .slice(0,6);
  }

  function transferLabel(tx){
    const transfer=tx&&tx.fundingBreakdown&&tx.fundingBreakdown.transfer;
    if(!transfer) return "";
    const source=transfer.sourceAccount||tx.sourceAccount||"";
    const destination=transfer.destinationAccount||tx.destinationAccount||"";
    if(!source&&!destination) return "";
    return [source,destination].filter(Boolean).join(" → ");
  }

  function detailRow(label,value){
    if(value===null||typeof value==="undefined"||value==="") return "";
    return `<div class="history-detail-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function inspectReserveTransaction(profile,id){
    const tx=(profile.transactions||[]).find(item=>String(item.id)===String(id));
    if(!tx||!reserveTypes.has(tx.type)) return false;
    const currency=tx.originalCurrency||tx.currency||tx.baseCurrency||profile.settings?.currency||"RUB";
    const label=tx.type==="reserve_deposit"?"Пополнение резерва":"Вывод из резерва";
    const direction=tx.type==="reserve_deposit"?"В резерв":"Из резерва";
    openModal(`<div class="history-detail reserve-history-detail">
      <div class="kicker">ОПЕРАЦИЯ РЕЗЕРВА</div>
      <h2 class="title">${esc(label)}</h2>
      <div class="history-detail-amount">${esc(money(Number(tx.originalAmount??tx.amount)||0,currency))}</div>
      <div class="history-detail-list">
        ${detailRow("Направление",direction)}
        ${detailRow("Дата",formatDate(tx.date||""))}
        ${detailRow("Источник",tx.source||"")}
        ${detailRow("Перевод",transferLabel(tx))}
        ${detailRow("Комментарий",tx.note||"")}
        ${detailRow("ID",tx.id)}
      </div>
      <div class="actions"><button class="btn" type="button" data-reserve-history-close>Закрыть</button></div>
    </div>`);
    document.querySelector("[data-reserve-history-close]")?.addEventListener("click",closeModal);
    return true;
  }

  function bindReserveRows(profile){
    const section=document.getElementById("reserveLifecycle");
    if(!section) return 0;
    const rows=[...section.querySelectorAll(".row")];
    const transactions=reserveTransactions(profile);
    let bound=0;
    rows.forEach((row,index)=>{
      const tx=transactions[index];
      if(!tx) return;
      row.dataset.reserveHistoryTx=String(tx.id);
      row.setAttribute("role","button");
      row.setAttribute("tabindex","0");
      row.setAttribute("aria-label","Открыть операцию резерва");
      const open=()=>inspectReserveTransaction(profile,tx.id);
      row.addEventListener("click",open);
      row.addEventListener("keydown",event=>{
        if(event.key==="Enter"||event.key===" "){
          event.preventDefault();
          open();
        }
      });
      bound++;
    });
    return bound;
  }

  function reserveSection(profile){
    const balance=safe(core.reserveBalance(profile));
    const free=safe(core.availableFree(profile,today()));
    const target=reserveTarget(profile);
    const progress=analytics.reserveProgress({reserveBalance:balance,targetBalance:target});
    const runway=runwayModel(profile);
    const monthly=runway.monthlyEssentialSpend||0;
    const months=runway.status==="ok"?runway.months:null;
    const complete=target>0&&(progress.complete===true||balance>=target);
    const remaining=target>0?safe(progress.remaining??Math.max(0,target-balance)):0;
    const surplus=complete?safe(progress.surplus??Math.max(0,balance-target)):0;
    const selected=selectedEssentialCategoryIds(profile);
    const reserveTx=reserveTransactions(profile);
    const explanation=runway.source==="configured"
      ?"Runway считается по заданной вручную месячной сумме обязательных расходов."
      :runway.source==="essential_categories"
        ?`Runway считается по среднему факту последних месяцев только по выбранным обязательным категориям: ${money(runway.categoryEstimate)}/мес.`
        :selected.length
          ?"По выбранным обязательным категориям пока недостаточно истории. Можно задать месячную сумму вручную."
          :"Выбери категории, которые действительно считаешь обязательными, или задай месячную сумму вручную. ARISE не считает все расходы обязательными автоматически.";

    const targetState=target>0?`<div class="reserve-target-state ${complete?"is-complete":"is-building"}" data-reserve-target-state="${complete?"complete":"building"}" role="status">
      <div><span>${complete?"Цель подушки достигнута":"Подушка формируется"}</span><strong>${complete?(surplus>0?`Сверх цели: ${money(surplus)}`:`Целевой баланс: ${money(target)}`):`До цели: ${money(remaining)}`}</strong></div>
      <p>${complete?"Цель — ориентир, а не автоматическая остановка. ARISE не меняет правило пополнения без твоего решения.":"Пополнения и выводы остаются отдельными операциями, а баланс считается только по истории."}</p>
    </div>`:"";

    return `<section class="card" id="reserveLifecycle" style="margin-top:16px">
      <div class="kicker">ФИНАНСОВАЯ ПОДУШКА</div>
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-top:8px">
        <div><div class="big-value">${money(balance)}</div><div class="sub" style="margin-top:6px">${target>0?`${Math.round(progress.percent||0)}% от цели ${money(target)}`:"Цель подушки пока не указана"}</div></div>
        <div style="text-align:right"><strong>${months===null?"—":`${months.toFixed(months<10?1:0)} мес.`}</strong><div class="tiny muted" style="margin-top:4px">${monthly?`при обязательных расходах ${money(monthly)}/мес.`:"нужен ориентир обязательных расходов"}</div></div>
      </div>
      ${targetState}
      <div class="notice" style="margin-top:14px">${explanation}</div>
      <div class="actions" style="margin-top:14px"><button class="btn primary" id="reserveDepositAction">Пополнить резерв</button><button class="btn" id="reserveWithdrawAction" ${balance<=0?"disabled":""}>Вывести из резерва</button></div>
      <div class="form" style="margin-top:16px">
        <div class="field"><label>Цель подушки</label><input id="reserveTargetBalance" type="number" min="0" value="${target||""}" placeholder="300000"></div>
        <div class="field"><label>Месячная сумма обязательных расходов — ручной приоритет</label><input id="reserveEssentialSpend" type="number" min="0" value="${safe(reserveSettings(profile).monthlyEssentialSpend)||""}" placeholder="Например 60000"><div class="tiny muted" style="margin-top:6px">Если указана, эта сумма используется вместо авторасчёта по категориям.</div></div>
        <div class="field full"><label>Категории обязательных расходов</label>${essentialCategoryOptions(profile)}<div class="tiny muted" style="margin-top:8px">Если ручная сумма пустая, ARISE использует среднее по этим категориям за последние доступные месяцы.</div></div>
      </div>
      <div class="actions"><button class="btn" id="saveReserveLifecycleSettings">Сохранить параметры подушки</button></div>
      ${reserveTx.length?`<div style="margin-top:18px"><div class="kicker">ПОСЛЕДНИЕ ОПЕРАЦИИ РЕЗЕРВА</div>${reserveTx.map(tx=>`<div class="row"><div class="row-left"><strong class="${tx.type==="reserve_deposit"?"positive":"negative"}">${tx.type==="reserve_deposit"?"+":"−"} ${money(tx.amount,tx.currency||profile.settings.currency)}</strong><div class="tiny muted">${escapeHTML(tx.source|| (tx.type==="reserve_deposit"?"Пополнение":"Вывод"))} · ${formatDate(tx.date)}</div></div></div>`).join("")}</div>`:""}
      <div class="tiny muted" style="margin-top:12px">Сейчас не распределено: ${money(free)}. Баланс резерва меняется только реальными операциями.</div>
    </section>`;
  }

  function appendReserveSection(){
    const page=document.getElementById("page");
    if(!page||document.getElementById("reserveLifecycle"))return;
    const profile=activeProfile();
    page.insertAdjacentHTML("beforeend",reserveSection(profile));
    document.getElementById("reserveDepositAction")?.addEventListener("click",showReserveDepositModal);
    document.getElementById("reserveWithdrawAction")?.addEventListener("click",showReserveWithdrawalModal);
    document.getElementById("saveReserveLifecycleSettings")?.addEventListener("click",()=>{
      const settings=reserveSettings(profile);
      settings.targetBalance=safe(document.getElementById("reserveTargetBalance")?.value);
      settings.monthlyEssentialSpend=safe(document.getElementById("reserveEssentialSpend")?.value);
      settings.essentialCategoryIds=[...document.querySelectorAll(".reserve-essential-category:checked")].map(input=>String(input.value));
      saveState();toast("Параметры подушки сохранены.");render();
    });
    bindReserveRows(profile);
  }

  if(typeof previousRenderSettings==="function"){
    root.renderSettings=function(){const result=previousRenderSettings();appendReserveSection();return result;};
  }

  function commitReserveTransaction(profile,tx,message){
    tx.createdAt=new Date().toISOString();
    tx.fundingBreakdown={...(tx.fundingBreakdown||{}),transfer:{sourceAccount:tx.sourceAccount,destinationAccount:tx.destinationAccount}};
    profile.transactions.push(tx);saveState();closeModal();activeMonth=core.monthKey(tx.date);toast(message);render();
  }

  function showReserveDepositModal(){
    const profile=activeProfile();
    const free=safe(core.availableFree(profile,today()));
    openModal(`<div class="kicker">ПОПОЛНЕНИЕ РЕЗЕРВА</div><h2 class="title">Перевести в подушку</h2><div class="sub" style="margin-top:7px">Доступно не распределено: ${money(free)}</div><div class="field" style="margin-top:18px"><label>Сумма</label><input id="reserveDepositAmount" type="number" min="1" max="${free}"></div><div class="field"><label>Комментарий</label><input id="reserveDepositNote" placeholder="По желанию"></div><div class="actions"><button class="btn primary" id="saveReserveDeposit">Пополнить</button><button class="btn" id="cancelReserveDeposit">Отмена</button></div>`);
    document.getElementById("cancelReserveDeposit").onclick=closeModal;
    document.getElementById("saveReserveDeposit").onclick=()=>{
      try{
        const tx=core.createReserveDeposit(profile,{id:uid(),amount:safe(document.getElementById("reserveDepositAmount")?.value),date:today(),currency:profile.settings.currency,note:document.getElementById("reserveDepositNote")?.value||""});
        commitReserveTransaction(profile,tx,"Резерв пополнен.");
      }catch(error){toast(error.message||"Не удалось пополнить резерв.");}
    };
  }

  function showReserveWithdrawalModal(){
    const profile=activeProfile();
    const balance=safe(core.reserveBalance(profile));
    openModal(`<div class="kicker">ВЫВОД ИЗ РЕЗЕРВА</div><h2 class="title">Вернуть в нераспределённое</h2><div class="sub" style="margin-top:7px">В резерве сейчас ${money(balance)}. Вывод не считается доходом — это перевод между твоими денежными слоями.</div><div class="field" style="margin-top:18px"><label>Сумма</label><input id="reserveWithdrawAmount" type="number" min="1" max="${balance}"></div><div class="field"><label>Комментарий</label><input id="reserveWithdrawNote" placeholder="По желанию"></div><div class="actions"><button class="btn primary" id="saveReserveWithdrawal">Вывести</button><button class="btn" id="cancelReserveWithdrawal">Отмена</button></div>`);
    document.getElementById("cancelReserveWithdrawal").onclick=closeModal;
    document.getElementById("saveReserveWithdrawal").onclick=()=>{
      try{
        const tx=core.createReserveWithdrawal(profile,{id:uid(),amount:safe(document.getElementById("reserveWithdrawAmount")?.value),date:today(),currency:profile.settings.currency,note:document.getElementById("reserveWithdrawNote")?.value||""});
        commitReserveTransaction(profile,tx,"Деньги возвращены из резерва в нераспределённое.");
      }catch(error){toast(error.message||"Не удалось вывести деньги из резерва.");}
    };
  }

  root.historyTransaction=function(tx){
    if(tx&&tx.type==="reserve_deposit")return `<div class="row"><div class="row-left"><strong class="positive">+ ${money(tx.amount,tx.currency)}</strong><div class="tiny muted">В резерв · ${escapeHTML(tx.note||tx.source||"Пополнение")} · ${formatDate(tx.date)}</div></div><div class="row-right"><div class="pill">Резерв</div></div></div>`;
    if(tx&&tx.type==="reserve_withdrawal")return `<div class="row"><div class="row-left"><strong class="negative">− ${money(tx.amount,tx.currency)}</strong><div class="tiny muted">Из резерва → не распределено · ${escapeHTML(tx.note||tx.source||"Вывод")} · ${formatDate(tx.date)}</div></div><div class="row-right"><div class="pill">Резерв</div></div></div>`;
    return typeof previousHistoryTransaction==="function"?previousHistoryTransaction(tx):"";
  };

  root.ARISE_RESERVE_LIFECYCLE={reserveSettings,selectedEssentialCategoryIds,categorySpendModel,runwayModel,reserveSection,appendReserveSection,showReserveDepositModal,showReserveWithdrawalModal,reserveTransactions,transferLabel,inspectReserveTransaction,bindReserveRows};
  root.ARISE_RESERVE_HISTORY_DRILLDOWN={reserveTransactions,transferLabel,inspectReserveTransaction,bindReserveRows};
})(typeof globalThis!=="undefined"?globalThis:window);
