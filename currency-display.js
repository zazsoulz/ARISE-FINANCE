(function(root){
  "use strict";

  const fx=root.ARISE_CURRENCY;
  const runtime=root.ARISE_CURRENCY_RUNTIME;
  if(!fx||!runtime) return;

  function hasForeignSnapshot(tx){
    return !!tx&&tx.originalCurrency&&tx.baseCurrency&&tx.originalCurrency!==tx.baseCurrency;
  }

  function displayTx(tx){
    if(!tx) return tx;
    return {
      ...tx,
      amount:tx.originalAmount!=null?tx.originalAmount:tx.amount,
      currency:tx.originalCurrency||tx.currency
    };
  }

  function equivalence(tx){
    if(!hasForeignSnapshot(tx)||tx.baseAmount==null) return "";
    const rate=Number(tx.exchangeRateToBase);
    const rateText=Number.isFinite(rate)&&rate>0
      ? ` · курс ${rate.toLocaleString("ru-RU",{maximumFractionDigits:4})}`
      : "";
    return `<div class="tiny muted" data-fx-equivalent>≈ ${fx.format(tx.baseAmount,tx.baseCurrency)}${rateText}</div>`;
  }

  function injectEquivalent(html,tx){
    const extra=equivalence(tx);
    if(!extra||typeof html!=="string") return html;
    const marker='<div class="tiny muted">';
    const index=html.indexOf(marker);
    if(index>=0) return html.slice(0,index)+extra+html.slice(index);
    return html.replace(/<\/div>\s*<div class="row-right">/,`</div>${extra}<div class="row-right">`);
  }

  function wrapRenderer(name){
    const original=root[name];
    if(typeof original!=="function"||original.__ariseCurrencyDisplay) return;
    const wrapped=function(tx,...args){return injectEquivalent(original(displayTx(tx),...args),tx);};
    wrapped.__ariseCurrencyDisplay=true;
    root[name]=wrapped;
  }

  wrapRenderer("incomeRow");
  wrapRenderer("expenseRow");
  wrapRenderer("historyTransaction");

  root.ARISE_CURRENCY_DISPLAY={displayTx,equivalence,injectEquivalent};
})(typeof globalThis!=="undefined"?globalThis:window);
