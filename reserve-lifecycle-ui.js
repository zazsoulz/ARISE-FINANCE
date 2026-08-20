(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  const analytics=root.ARISE_RESERVE_ANALYTICS;
  if(!core||!analytics)return;

  const previousRenderSettings=root.renderSettings;
  const previousHistoryTransaction=root.historyTransaction;
  const safe=value=>Math.max(0,Math.round(Number(value)||0));

  function reserveSettings(profile){
    profile.settings=profile.settings||{};
    profile.settings.reserve=profile.settings.reserve||{};
    return profile.settings.reserve;
  }

  function recentAverageSpend(profile,count=3){
    const months=typeof allMonths==="function"?allMonths(profile).slice(-count):[];
    const values=months.map(month=>safe(core.monthStats(profile,month).expenses));
    const positive=values.filter(value=>value>0);
    return positive.length?Math.round(positive.reduce((sum,value)=>sum+value,0)/positive.length):0;
  }

  function runwayModel(profile){
    const settings=reserveSettings(profile);
    const configured=safe(settings.monthlyEssentialSpend);
    const auto=recentAverageSpend(profile,3);
    const monthly=configured||auto;
    const model=analytics.reserveRunway({reserveBalance:core.reserveBalance(profile),monthlyEssentialSpend:monthly});
    return {...model,source:configured?"configured":auto?"average_expenses":"none",autoEstimate:auto};
  }

  function reserveTarget(profile){return safe(reserveSettings(profile).targetBalance||reserveSettings(profile).target||0);}

  function reserveSection(profile){
    const balance=safe(core.reserveBalance(profile));
    const free=safe(core.availableFree(profile,today()));
    const target=reserveTarget(profile);
    const progress=analytics.reserveProgress({reserveBalance:balance,targetBalance:target});
    const runway=runwayModel(profile);
    const monthly=runway.monthlyEssentialSpend||0;
    const months=runway.status==="ok"?runway.months:null;
    const reserveTx=(profile.transactions||[]).filter(tx=>tx.type==="reserve_deposit"||tx.type==="reserve_withdrawal").slice().reverse().slice(0,6);

    return `<section class="card" id="reserveLifecycle" style="margin-top:16px">
      <div class="kicker">ФИНАНСОВАЯ ПОДУШКА</div>
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-top:8px">
        <div><div class="big-value">${money(balance)}</div><div class="sub" style="margin-top:6px">${target>0?`${Math.round(progress.percent||0)}% от цели ${money(target)}`:"Цель подушки пока не указана"}</div></div>
        <div style="text-align:right"><strong>${months===null?"—":`${months.toFixed(months<10?1:0)} мес.`}</strong><div class="tiny muted" style="margin-top:4px">${monthly?`при расходах ${money(monthly)}/мес.`:"нужен месячный ориентир расходов"}</div></div>
      </div>
      <div class="notice" style="margin-top:14px">${runway.source==="configured"?"Runway считается по твоему месячному ориентиру расходов.":runway.source==="average_expenses"?`Пока используется автооценка по средним фактическим расходам последних месяцев: ${money(runway.autoEstimate)}/мес. Ты можешь задать свой ориентир ниже.`:"Укажи месячный ориентир расходов — ARISE покажет, на сколько хватит подушки без доходов."}</div>
      <div class="actions" style="margin-top:14px"><button class="btn primary" id="reserveDepositAction">Пополнить резерв</button><button class="btn" id="reserveWithdrawAction" ${balance<=0?"disabled":""}>Вывести из резерва</button></div>
      <div class="form" style="margin-top:16px">
        <div class="field"><label>Цель подушки</label><input id="reserveTargetBalance" type="number" min="0" value="${target||""}" placeholder="300000"></div>
        <div class="field"><label>Месячный ориентир расходов для runway</label><input id="reserveEssentialSpend" type="number" min="0" value="${safe(reserveSettings(profile).monthlyEssentialSpend)||""}" placeholder="Например 60000"></div>
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
      saveState();toast("Параметры подушки сохранены.");render();
    });
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

  root.ARISE_RESERVE_LIFECYCLE={reserveSettings,recentAverageSpend,runwayModel,reserveSection,appendReserveSection,showReserveDepositModal,showReserveWithdrawalModal};
})(typeof globalThis!=="undefined"?globalThis:window);
