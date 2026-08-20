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