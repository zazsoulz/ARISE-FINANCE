(function(root){
  "use strict";

  const fx=root.ARISE_CURRENCY;
  const core=root.ARISE_FINANCE_CORE;
  if(!fx||!core) return;

  const originalCalculateIncomePlan=root.calculateIncomePlan;
  const originalCreateIncome=root.createIncomeTransaction;
  const originalCreateExpense=root.createExpenseTransaction;
  const originalRenderIncomePlan=root.renderIncomePlan;
  const originalUpdateIncomePlanUI=root.updateIncomePlanUI;
  let lastIncomePlan=null;

  function baseCurrency(profile){return fx.normalizeCurrency(profile&&profile.settings&&profile.settings.currency||"RUB");}
  function currentIncomeCurrency(profile){
    const el=typeof document!=="undefined"&&document.getElementById("incomeCurrency");
    return fx.normalizeCurrency(el&&el.value,baseCurrency(profile));
  }
  function currentBook(){return fx.loadCached();}
  function planSnapshot(profile,originalAmount,originalCurrency){return fx.snapshot(originalAmount,originalCurrency,baseCurrency(profile),currentBook());}

  root.calculateIncomePlan=function(profile,income,date){
    const originalCurrency=currentIncomeCurrency(profile);
    const snap=planSnapshot(profile,income,originalCurrency);
    if(snap.conversionPending){
      lastIncomePlan={valid:false,fxPending:true,total:0,allocations:[],goalAllocations:[],reserve:0,remainder:0,distributed:0,date,originalAmount:snap.originalAmount,originalCurrency:snap.originalCurrency,baseCurrency:snap.baseCurrency,fxSnapshot:snap};
      return lastIncomePlan;
    }
    const plan=originalCalculateIncomePlan(profile,snap.baseAmount,date);
    lastIncomePlan={...plan,originalAmount:snap.originalAmount,originalCurrency:snap.originalCurrency,baseCurrency:snap.baseCurrency,fxSnapshot:snap};
    return lastIncomePlan;
  };

  function withIncomeSelectCurrency(currency,callback){
    const select=typeof document!=="undefined"&&document.getElementById("incomeCurrency");
    if(!select)return callback();
    const previous=select.value;
    select.value=currency;
    try{return callback();}finally{select.value=previous;}
  }

  root.updateIncomePlanUI=function(plan){
    if(plan&&plan.fxPending)return;
    const currency=plan&&plan.baseCurrency||baseCurrency(root.activeProfile&&root.activeProfile());
    return withIncomeSelectCurrency(currency,()=>originalUpdateIncomePlanUI(plan));
  };

  root.renderIncomePlan=function(plan){
    lastIncomePlan=plan||lastIncomePlan;
    const container=typeof document!=="undefined"&&document.getElementById("incomePlan");
    if(plan&&plan.fxPending){
      if(!container)return;
      container.innerHTML=`<div class="notice warning">Для распределения ${fx.format(plan.originalAmount,plan.originalCurrency)} нужен курс ${plan.originalCurrency} → ${plan.baseCurrency}. ARISE не будет придумывать курс и искажать твой финансовый план.</div><div class="actions"><button class="btn primary" id="refreshFxForIncome">Обновить курс</button></div>`;
      const button=document.getElementById("refreshFxForIncome");
      if(button)button.onclick=async()=>{
        button.disabled=true;
        try{
          const result=await fx.ensureRateBook({force:true});
          if(!result.book)throw result.error||new Error("Курс недоступен");
          const profile=activeProfile();
          const amount=Math.max(0,integer(document.getElementById("incomeAmount")?.value));
          const date=document.getElementById("incomeDate")?.value||today();
          root.renderIncomePlan(root.calculateIncomePlan(profile,amount,date));
        }catch(error){console.error("ARISE FX income refresh",error);toast("Не удалось обновить курс. Попробуй позже.");}
        finally{button.disabled=false;}
      };
      return;
    }

    const base=plan&&plan.baseCurrency||baseCurrency(activeProfile());
    withIncomeSelectCurrency(base,()=>originalRenderIncomePlan(plan));
    if(container&&plan&&plan.originalCurrency&&plan.originalCurrency!==base){
      const snap=plan.fxSnapshot||{};
      container.insertAdjacentHTML("afterbegin",`<div class="notice" style="margin-bottom:14px">${fx.format(plan.originalAmount,plan.originalCurrency)} ≈ <strong>${fx.format(plan.total,base)}</strong> · курс ${Number(snap.exchangeRateToBase||0).toLocaleString("ru-RU",{maximumFractionDigits:4})} · ${escapeHTML(snap.fxSource||"курс")}</div>`);
    }
  };

  root.createIncomeTransaction=function(profile,data){
    const snap=lastIncomePlan&&lastIncomePlan.fxSnapshot&&!lastIncomePlan.fxSnapshot.conversionPending
      ? lastIncomePlan.fxSnapshot
      : fx.snapshot(data.originalAmount!=null?data.originalAmount:data.amount,data.originalCurrency||data.currency,baseCurrency(profile),currentBook());
    if(snap.conversionPending)throw new Error("Не удалось определить курс для дохода.");
    const tx=originalCreateIncome(profile,{...data,amount:snap.baseAmount,currency:snap.baseCurrency});
    Object.assign(tx,{originalAmount:snap.originalAmount,originalCurrency:snap.originalCurrency,baseAmount:snap.baseAmount,baseCurrency:snap.baseCurrency,exchangeRateToBase:snap.exchangeRateToBase,fxSource:snap.fxSource,fxFetchedAt:snap.fxFetchedAt,conversionPending:false});
    return tx;
  };

  root.createExpenseTransaction=function(profile,data){
    const snap=fx.snapshot(data.originalAmount!=null?data.originalAmount:data.amount,data.originalCurrency||data.currency,baseCurrency(profile),currentBook());
    if(snap.conversionPending)throw new Error("Для расхода в другой валюте сначала нужен актуальный или сохранённый курс.");
    const tx=originalCreateExpense(profile,{...data,amount:snap.baseAmount,currency:snap.baseCurrency});
    Object.assign(tx,{originalAmount:snap.originalAmount,originalCurrency:snap.originalCurrency,baseAmount:snap.baseAmount,baseCurrency:snap.baseCurrency,exchangeRateToBase:snap.exchangeRateToBase,fxSource:snap.fxSource,fxFetchedAt:snap.fxFetchedAt,conversionPending:false});
    return tx;
  };

  function originalDisplay(tx){return !tx?{amount:0,currency:"RUB"}:{amount:tx.originalAmount!=null?tx.originalAmount:tx.amount,currency:tx.originalCurrency||tx.currency};}
  function currentBaseValue(tx,profile){return fx.transactionBaseAmount(tx,baseCurrency(profile),currentBook(),{preferCurrentRate:true});}
  async function refreshRates(force=false){const result=await fx.ensureRateBook({force});root.dispatchEvent&&root.dispatchEvent(new CustomEvent("arise:fx",{detail:result}));return result;}

  root.ARISE_CURRENCY_RUNTIME={baseCurrency,currentBook,planSnapshot,originalDisplay,currentBaseValue,refreshRates,lastIncomePlan:()=>lastIncomePlan};
  if(root.addEventListener){root.addEventListener("online",()=>refreshRates(false).catch(()=>{}));setTimeout(()=>refreshRates(false).catch(()=>{}),0);}
})(typeof globalThis!=="undefined"?globalThis:window);
