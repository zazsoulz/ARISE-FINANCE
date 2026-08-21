(function(root){
  "use strict";

  const fx=root.ARISE_CURRENCY;
  const runtime=root.ARISE_CURRENCY_RUNTIME;
  const core=root.ARISE_FINANCE_CORE;
  if(!fx||!runtime) return;

  function hasForeignSnapshot(tx){return !!tx&&tx.originalCurrency&&tx.baseCurrency&&tx.originalCurrency!==tx.baseCurrency;}
  function displayTx(tx){return !tx?tx:{...tx,amount:tx.originalAmount!=null?tx.originalAmount:tx.amount,currency:tx.originalCurrency||tx.currency};}
  function equivalence(tx){
    if(!hasForeignSnapshot(tx)||tx.baseAmount==null)return "";
    const rate=Number(tx.exchangeRateToBase),rateText=Number.isFinite(rate)&&rate>0?` · курс ${rate.toLocaleString("ru-RU",{maximumFractionDigits:4})}`:"";
    return `<div class="tiny muted" data-fx-equivalent>≈ ${fx.format(tx.baseAmount,tx.baseCurrency)}${rateText}</div>`;
  }
  function injectEquivalent(html,tx){
    const extra=equivalence(tx);if(!extra||typeof html!=="string")return html;
    const marker='<div class="tiny muted">',index=html.indexOf(marker);
    if(index>=0)return html.slice(0,index)+extra+html.slice(index);
    return html.replace(/<\/div>\s*<div class="row-right">/,`</div>${extra}<div class="row-right">`);
  }
  function wrapSimpleRenderer(name){
    const original=root[name];if(typeof original!=="function"||original.__ariseCurrencyDisplay)return;
    const wrapped=function(tx,...args){return injectEquivalent(original(displayTx(tx),...args),tx);};wrapped.__ariseCurrencyDisplay=true;root[name]=wrapped;
  }

  const originalHistory=root.historyTransaction;
  function foreignHistory(tx){
    const original=displayTx(tx),base=tx.baseCurrency||tx.currency;
    if(tx.type==="income"){
      const remainder=core&&core.historicalRemainder?core.historicalRemainder(tx):Math.max(0,Number(tx.remainder)||0);
      return `
        <div class="row"><div class="row-left"><strong class="positive">+ ${money(original.amount,original.currency)}</strong>${equivalence(tx)}<div class="tiny muted">${escapeHTML(tx.source||"Источник не указан")} · ${formatDate(tx.date)}</div></div><div class="row-right"><div class="pill">Доход</div></div></div>
        <div class="allocation-grid" style="margin-top:0">
          ${(tx.allocations||[]).map(item=>`<div class="allocation"><div class="allocation-name">${escapeHTML(item.name)}</div><div class="allocation-value">${money(item.amount,base)}</div></div>`).join("")}
          ${(tx.goalAllocations||[]).map(item=>`<div class="allocation"><div class="allocation-name">ЦЕЛЬ · ${escapeHTML(item.name)}</div><div class="allocation-value">${money(item.amount,base)}</div></div>`).join("")}
          ${tx.reserve?`<div class="allocation"><div class="allocation-name">РЕЗЕРВ</div><div class="allocation-value">${money(tx.reserve,base)}</div></div>`:""}
          ${remainder?`<div class="allocation"><div class="allocation-name">НЕ РАСПРЕДЕЛЕНО</div><div class="allocation-value">${money(remainder,base)}</div></div>`:""}
        </div>`;
    }
    if(tx.type==="expense"){
      const breakdown=tx.fundingBreakdown||{};
      const categoryAmount=Math.max(0,Number(breakdown.category??tx.categoryControlledAmount??0));
      const unallocatedAmount=Math.max(0,Number(breakdown.unallocated??tx.unallocatedControlledAmount??0));
      const uncontrolledAmount=Math.max(0,Number(breakdown.uncontrolled??tx.uncontrolledAmount??0));
      const parts=[];
      if(categoryAmount)parts.push(`${escapeHTML(tx.categoryName||"Категория")}: ${money(categoryAmount,base)}`);
      if(unallocatedAmount)parts.push(`Не распределено: ${money(unallocatedAmount,base)}`);
      if(uncontrolledAmount)parts.push(`Неконтролируемые: ${money(uncontrolledAmount,base)}`);
      return `<div class="row"><div class="row-left"><strong class="negative">- ${money(original.amount,original.currency)}</strong>${equivalence(tx)}<div class="tiny muted">${escapeHTML(tx.source||"Без описания")} · ${formatDate(tx.date)}</div>${parts.length?`<div class="tiny muted" style="margin-top:4px">${parts.join(" · ")}</div>`:""}</div><div class="row-right"><div class="pill">Расход</div></div></div>`;
    }
    return injectEquivalent(typeof originalHistory==="function"?originalHistory(displayTx(tx)):"",tx);
  }

  wrapSimpleRenderer("incomeRow");
  wrapSimpleRenderer("expenseRow");
  if(typeof originalHistory==="function")root.historyTransaction=function(tx,...args){return hasForeignSnapshot(tx)?foreignHistory(tx):originalHistory(tx,...args);};

  root.ARISE_CURRENCY_DISPLAY={displayTx,equivalence,injectEquivalent,foreignHistory};
})(typeof globalThis!=="undefined"?globalThis:window);

(function(root){
  "use strict";

  const fx=root.ARISE_CURRENCY;
  const runtime=root.ARISE_CURRENCY_RUNTIME;
  if(!fx||!runtime) return;

  const originalRenderIncomePlan=root.renderIncomePlan;
  const originalUpdateExpensePreview=root.updateExpensePreview;

  function status(book=runtime.currentBook()){
    return fx.rateBookStatus(book);
  }

  function staleNotice(){
    const info=status();
    if(!info.available||!info.stale) return "";
    const hours=Math.max(1,Math.floor(info.ageMs/(60*60*1000)));
    const age=hours<48?`${hours} ч`:`${Math.floor(hours/24)} дн.`;
    return `<div class="notice warning arise-fx-stale" style="margin-top:10px">Используется сохранённый курс ${escapeHTML(info.source||"кеш")} возрастом ${age}. Сумма будет сохранена с этим FX snapshot. <button class="btn small-btn" type="button" data-refresh-stale-fx>Обновить курс</button></div>`;
  }

  function localDay(value){
    if(!value)return "";
    const match=String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match?match[1]:"";
  }

  function isBackdated(date,currentDate=(typeof today==="function"?today():new Date().toISOString().slice(0,10))){
    const operationDay=localDay(date);
    const currentDay=localDay(currentDate);
    return Boolean(operationDay&&currentDay&&operationDay<currentDay);
  }

  function backdatedNotice(date){
    if(!isBackdated(date))return "";
    return `<div class="notice arise-fx-backdated" style="margin-top:10px">Операция записывается задним числом. ARISE использует курс, доступный в момент сохранения, и фиксирует его в неизменяемом FX snapshot. Исторический курс за выбранную дату автоматически не подставляется.</div>`;
  }

  async function refresh(button,rerender){
    if(button) button.disabled=true;
    try{
      const result=await runtime.refreshRates(true);
      if(!result||!result.book) throw result&&result.error||new Error("Курс недоступен");
      rerender();
    }catch(error){
      console.error("ARISE stale FX refresh",error);
      if(typeof toast==="function") toast("Не удалось обновить курс. Сохранённый курс остаётся доступен.");
    }finally{
      if(button) button.disabled=false;
    }
  }

  function bind(container,rerender){
    if(!container) return;
    const button=container.querySelector("[data-refresh-stale-fx]");
    if(button) button.onclick=()=>refresh(button,rerender);
  }

  root.renderIncomePlan=function(plan){
    originalRenderIncomePlan(plan);
    const container=document.getElementById("incomePlan");
    const foreign=plan&&plan.originalCurrency&&plan.baseCurrency&&plan.originalCurrency!==plan.baseCurrency&&!plan.fxPending;
    if(!container||!foreign) return;
    const date=plan.date||document.getElementById("incomeDate")?.value||"";
    const historical=backdatedNotice(date);
    if(historical)container.insertAdjacentHTML("beforeend",historical);
    const notice=staleNotice();
    if(notice) container.insertAdjacentHTML("beforeend",notice);
    bind(container,()=>{
      const profile=activeProfile();
      const amount=Math.max(0,integer(document.getElementById("incomeAmount")?.value));
      const date=document.getElementById("incomeDate")?.value||today();
      root.renderIncomePlan(root.calculateIncomePlan(profile,amount,date));
    });
  };

  root.updateExpensePreview=function(){
    originalUpdateExpensePreview();
    const preview=document.getElementById("expensePreview");
    const snap=runtime.expenseFormSnapshot();
    const foreign=snap&&snap.originalCurrency!==snap.baseCurrency&&!snap.conversionPending;
    if(!preview||!foreign) return;
    const historical=backdatedNotice(document.getElementById("expenseDate")?.value||"");
    if(historical)preview.insertAdjacentHTML("beforeend",historical);
    const notice=staleNotice();
    if(notice) preview.insertAdjacentHTML("beforeend",notice);
    bind(preview,()=>root.updateExpensePreview());
  };

  root.ARISE_FX_FRESHNESS_UI={status,staleNotice,isBackdated,backdatedNotice};
})(typeof globalThis!=="undefined"?globalThis:window);
