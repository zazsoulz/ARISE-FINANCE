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
  const originalShowExpenseModal=root.showExpenseModal;
  let lastIncomePlan=null;

  function baseCurrency(profile){return fx.normalizeCurrency(profile&&profile.settings&&profile.settings.currency||"RUB");}
  function currentIncomeCurrency(profile){const el=typeof document!=="undefined"&&document.getElementById("incomeCurrency");return fx.normalizeCurrency(el&&el.value,baseCurrency(profile));}
  function currentBook(){return fx.loadCached();}
  function planSnapshot(profile,originalAmount,originalCurrency){return fx.snapshot(originalAmount,originalCurrency,baseCurrency(profile),currentBook());}
  function rateAgeLabel(book){
    if(!book)return "";
    const age=fx.ageMs(book);
    if(age<60*60*1000)return "курс обновлён недавно";
    const hours=Math.floor(age/(60*60*1000));
    if(hours<48)return `курс обновлён ${hours} ч назад`;
    return `кеш курса старше ${Math.floor(hours/24)} дн.`;
  }

  root.calculateIncomePlan=function(profile,income,date){
    const originalCurrency=currentIncomeCurrency(profile),snap=planSnapshot(profile,income,originalCurrency);
    if(snap.conversionPending){lastIncomePlan={valid:false,fxPending:true,total:0,allocations:[],goalAllocations:[],reserve:0,remainder:0,distributed:0,date,originalAmount:snap.originalAmount,originalCurrency:snap.originalCurrency,baseCurrency:snap.baseCurrency,fxSnapshot:snap};return lastIncomePlan;}
    const plan=originalCalculateIncomePlan(profile,snap.baseAmount,date);
    lastIncomePlan={...plan,originalAmount:snap.originalAmount,originalCurrency:snap.originalCurrency,baseCurrency:snap.baseCurrency,fxSnapshot:snap};return lastIncomePlan;
  };

  function withIncomeSelectCurrency(currency,callback){
    const select=typeof document!=="undefined"&&document.getElementById("incomeCurrency");if(!select)return callback();const previous=select.value;select.value=currency;try{return callback();}finally{select.value=previous;}
  }

  root.updateIncomePlanUI=function(plan){if(plan&&plan.fxPending)return;const currency=plan&&plan.baseCurrency||baseCurrency(root.activeProfile&&root.activeProfile());return withIncomeSelectCurrency(currency,()=>originalUpdateIncomePlanUI(plan));};

  root.renderIncomePlan=function(plan){
    lastIncomePlan=plan||lastIncomePlan;const container=typeof document!=="undefined"&&document.getElementById("incomePlan");
    if(plan&&plan.fxPending){
      if(!container)return;
      container.innerHTML=`<div class="notice warning">Для распределения ${fx.format(plan.originalAmount,plan.originalCurrency)} нужен курс ${plan.originalCurrency} → ${plan.baseCurrency}. ARISE не будет придумывать курс и искажать твой финансовый план.</div><div class="actions"><button class="btn primary" id="refreshFxForIncome">Обновить курс</button></div>`;
      const button=document.getElementById("refreshFxForIncome");if(button)button.onclick=async()=>{button.disabled=true;try{const result=await fx.ensureRateBook({force:true});if(!result.book)throw result.error||new Error("Курс недоступен");const profile=activeProfile();const amount=Math.max(0,integer(document.getElementById("incomeAmount")?.value));const date=document.getElementById("incomeDate")?.value||today();root.renderIncomePlan(root.calculateIncomePlan(profile,amount,date));}catch(error){console.error("ARISE FX income refresh",error);toast("Не удалось обновить курс. Попробуй позже.");}finally{button.disabled=false;}};
      return;
    }
    const base=plan&&plan.baseCurrency||baseCurrency(activeProfile());withIncomeSelectCurrency(base,()=>originalRenderIncomePlan(plan));
    if(container&&plan&&plan.originalCurrency&&plan.originalCurrency!==base){const snap=plan.fxSnapshot||{},book=currentBook();container.insertAdjacentHTML("afterbegin",`<div class="notice" style="margin-bottom:14px">${fx.format(plan.originalAmount,plan.originalCurrency)} ≈ <strong>${fx.format(plan.total,base)}</strong> · курс ${Number(snap.exchangeRateToBase||0).toLocaleString("ru-RU",{maximumFractionDigits:4})} · ${escapeHTML(snap.fxSource||"курс")}${book?` · ${escapeHTML(rateAgeLabel(book))}`:""}</div>`);}
  };

  root.createIncomeTransaction=function(profile,data){
    const snap=lastIncomePlan&&lastIncomePlan.fxSnapshot&&!lastIncomePlan.fxSnapshot.conversionPending?lastIncomePlan.fxSnapshot:fx.snapshot(data.originalAmount!=null?data.originalAmount:data.amount,data.originalCurrency||data.currency,baseCurrency(profile),currentBook());
    if(snap.conversionPending)throw new Error("Не удалось определить курс для дохода.");
    const tx=originalCreateIncome(profile,{...data,amount:snap.baseAmount,currency:snap.baseCurrency});Object.assign(tx,{originalAmount:snap.originalAmount,originalCurrency:snap.originalCurrency,baseAmount:snap.baseAmount,baseCurrency:snap.baseCurrency,exchangeRateToBase:snap.exchangeRateToBase,fxSource:snap.fxSource,fxFetchedAt:snap.fxFetchedAt,conversionPending:false});return tx;
  };

  root.createExpenseTransaction=function(profile,data){
    const snap=fx.snapshot(data.originalAmount!=null?data.originalAmount:data.amount,data.originalCurrency||data.currency,baseCurrency(profile),currentBook());
    if(snap.conversionPending)throw new Error("Для расхода в другой валюте сначала нужен актуальный или сохранённый курс.");
    const tx=originalCreateExpense(profile,{...data,amount:snap.baseAmount,currency:snap.baseCurrency});Object.assign(tx,{originalAmount:snap.originalAmount,originalCurrency:snap.originalCurrency,baseAmount:snap.baseAmount,baseCurrency:snap.baseCurrency,exchangeRateToBase:snap.exchangeRateToBase,fxSource:snap.fxSource,fxFetchedAt:snap.fxFetchedAt,conversionPending:false});return tx;
  };

  function expenseFormSnapshot(){
    if(typeof document==="undefined")return null;
    const profile=activeProfile();
    const originalAmount=Math.max(0,integer(document.getElementById("expenseAmount")?.value));
    const originalCurrency=fx.normalizeCurrency(document.getElementById("expenseCurrency")?.value,baseCurrency(profile));
    return fx.snapshot(originalAmount,originalCurrency,baseCurrency(profile),currentBook());
  }

  async function refreshExpenseRate(button){
    if(button)button.disabled=true;
    try{const result=await fx.ensureRateBook({force:true});if(!result.book)throw result.error||new Error("Курс недоступен");root.updateExpensePreview();}
    catch(error){console.error("ARISE FX expense refresh",error);toast("Не удалось обновить курс. Попробуй позже.");}
    finally{if(button)button.disabled=false;}
  }

  root.updateExpensePreview=function(){
    const preview=typeof document!=="undefined"&&document.getElementById("expensePreview");if(!preview)return;
    const profile=activeProfile(),snap=expenseFormSnapshot();if(!snap||snap.originalAmount<=0){preview.innerHTML="";return;}
    if(snap.conversionPending){preview.innerHTML=`<div class="notice warning">Для расхода ${fx.format(snap.originalAmount,snap.originalCurrency)} нужен курс ${snap.originalCurrency} → ${snap.baseCurrency}. Без курса ARISE не сможет правильно определить перерасход.</div><div class="actions"><button class="btn primary" id="refreshFxForExpense">Обновить курс</button></div>`;const button=document.getElementById("refreshFxForExpense");if(button)button.onclick=()=>refreshExpenseRate(button);return;}
    const categoryId=document.getElementById("expenseCategory")?.value||null,date=document.getElementById("expenseDate")?.value||today();
    const funding=root.ARISE_EXPENSE_FUNDING&&root.ARISE_EXPENSE_FUNDING.expenseFunding?root.ARISE_EXPENSE_FUNDING.expenseFunding(profile,{amount:snap.baseAmount,date,categoryId}):null;
    const book=currentBook(),foreign=snap.originalCurrency!==snap.baseCurrency;
    const conversion=foreign?`${fx.format(snap.originalAmount,snap.originalCurrency)} ≈ <strong>${fx.format(snap.baseAmount,snap.baseCurrency)}</strong> · курс ${Number(snap.exchangeRateToBase).toLocaleString("ru-RU",{maximumFractionDigits:4})}${book?` · ${escapeHTML(rateAgeLabel(book))}`:""}`:fx.format(snap.baseAmount,snap.baseCurrency);
    if(funding&&funding.uncontrolledAmount>0){preview.innerHTML=`<div class="notice warning">${conversion}<br>Контролируемыми деньгами покрывается ${fx.format(funding.controlledAmount,snap.baseCurrency)}, ещё <strong>${fx.format(funding.uncontrolledAmount,snap.baseCurrency)}</strong> не объяснены текущим финансовым планом.</div>`;}
    else{preview.innerHTML=`<div class="notice">${conversion}<br>${categoryId?"Расход полностью покрывается выбранной категорией/нераспределённым остатком.":"Расход полностью покрывается нераспределённым остатком."}</div>`;}
  };

  root.saveExpenseFromModal=function(){
    const profile=activeProfile(),snap=expenseFormSnapshot();
    if(!snap||snap.originalAmount<=0){toast("Введи сумму расхода.");return;}
    if(snap.conversionPending){toast("Сначала обнови курс валюты для этого расхода.");root.updateExpensePreview();return;}
    const categoryId=document.getElementById("expenseCategory").value,category=profile.categories.find(c=>c.id===categoryId),date=document.getElementById("expenseDate").value||today();
    try{
      root.createExpenseTransaction(profile,{amount:snap.originalAmount,originalAmount:snap.originalAmount,originalCurrency:snap.originalCurrency,date,source:document.getElementById("expenseSource").value,categoryId:categoryId||null,categoryName:category?.name||"Нераспределено",currency:snap.originalCurrency,note:document.getElementById("expenseNote").value});
    }catch(error){console.error("ARISE expense FX",error);toast(error.message||"Не удалось сохранить расход.");return;}
    saveState();closeModal();activeMonth=monthKey(date);toast("Расход сохранён.");render();
  };

  if(typeof originalShowExpenseModal==="function"){
    root.showExpenseModal=function(){
      originalShowExpenseModal();
      for(const id of ["expenseAmount","expenseCurrency","expenseCategory","expenseDate"]){const el=document.getElementById(id);if(el)el.addEventListener(id==="expenseAmount"?"input":"change",root.updateExpensePreview);}
      const save=document.getElementById("saveExpense");if(save)save.onclick=root.saveExpenseFromModal;root.updateExpensePreview();
    };
  }

  function originalDisplay(tx){return !tx?{amount:0,currency:"RUB"}:{amount:tx.originalAmount!=null?tx.originalAmount:tx.amount,currency:tx.originalCurrency||tx.currency};}
  function currentBaseValue(tx,profile){return fx.transactionBaseAmount(tx,baseCurrency(profile),currentBook(),{preferCurrentRate:true});}
  async function refreshRates(force=false){const result=await fx.ensureRateBook({force});root.dispatchEvent&&root.dispatchEvent(new CustomEvent("arise:fx",{detail:result}));return result;}

  root.ARISE_CURRENCY_RUNTIME={baseCurrency,currentBook,planSnapshot,expenseFormSnapshot,originalDisplay,currentBaseValue,refreshRates,rateAgeLabel,lastIncomePlan:()=>lastIncomePlan};
  if(root.addEventListener){root.addEventListener("online",()=>refreshRates(false).catch(()=>{}));setTimeout(()=>refreshRates(false).catch(()=>{}),0);}
})(typeof globalThis!=="undefined"?globalThis:window);
