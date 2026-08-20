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
