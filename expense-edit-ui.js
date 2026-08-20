(function(root){
  "use strict";

  const fundingApi=root.ARISE_EXPENSE_FUNDING;
  if(!fundingApi||typeof fundingApi.expenseFunding!=="function")return;

  const safe=value=>Math.max(0,Math.round(Number(value)||0));
  const esc=value=>escapeHTML(String(value??""));

  function expenseById(profile,id){
    return (profile.transactions||[]).find(tx=>String(tx.id)===String(id)&&tx.type==="expense")||null;
  }

  function profileWithoutExpense(profile,transactionId){
    return {...profile,transactions:(profile.transactions||[]).filter(tx=>String(tx.id)!==String(transactionId))};
  }

  function snapshot(profile,originalAmount,originalCurrency){
    const runtime=root.ARISE_CURRENCY_RUNTIME;
    if(runtime&&typeof runtime.planSnapshot==="function")return runtime.planSnapshot(profile,originalAmount,originalCurrency);
    const base=profile.settings&&profile.settings.currency||"RUB";
    if(String(originalCurrency||base)!==String(base))return {conversionPending:true,originalAmount:safe(originalAmount),originalCurrency:originalCurrency||base,baseCurrency:base};
    return {conversionPending:false,originalAmount:safe(originalAmount),originalCurrency:base,baseAmount:safe(originalAmount),baseCurrency:base,exchangeRateToBase:1,fxSource:"identity",fxFetchedAt:null};
  }

  function editFunding(profile,tx,{amount,date,categoryId}){
    return fundingApi.expenseFunding(profileWithoutExpense(profile,tx.id),{amount,date,categoryId});
  }

  function candidates(profile,tx,{amount,date,categoryId}){
    const shadow=profileWithoutExpense(profile,tx.id);
    const result=[];
    const add=(id,name)=>{
      const funding=fundingApi.expenseFunding(shadow,{amount,date,categoryId:id||null});
      result.push({id:id||null,name,current:String(id||"")===String(categoryId||""),controlled:safe(funding.controlledAmount),uncontrolled:safe(funding.uncontrolledAmount)});
    };
    add(null,"Нераспределено");
    for(const category of profile.categories||[])if(category&&category.enabled!==false)add(category.id,category.name||"Категория");
    return result.sort((a,b)=>Number(b.uncontrolled===0)-Number(a.uncontrolled===0)||b.controlled-a.controlled||a.name.localeCompare(b.name,"ru"));
  }

  function formDraft(){
    return {
      originalAmount:safe(document.getElementById("editExpenseAmount")?.value),
      originalCurrency:document.getElementById("editExpenseCurrency")?.value||"RUB",
      date:document.getElementById("editExpenseDate")?.value||today(),
      categoryId:document.getElementById("editExpenseCategory")?.value||null,
      source:document.getElementById("editExpenseSource")?.value||"",
      note:document.getElementById("editExpenseNote")?.value||""
    };
  }

  function renderEditPreview(profile,tx){
    const preview=document.getElementById("editExpensePreview");
    const save=document.getElementById("saveExpenseEdit");
    if(!preview||!save)return;
    const draft=formDraft();
    if(draft.originalAmount<=0){preview.innerHTML="";save.disabled=true;return;}

    const snap=snapshot(profile,draft.originalAmount,draft.originalCurrency);
    if(snap.conversionPending){
      preview.innerHTML=`<div class="notice warning">Для изменения расхода нужен курс ${esc(snap.originalCurrency)} → ${esc(snap.baseCurrency)}. ARISE не будет пересчитывать операцию без подтверждённого курса.</div><div class="actions"><button type="button" class="btn small-btn" id="refreshExpenseEditFx">Обновить курс</button></div>`;
      save.disabled=true;
      const refresh=document.getElementById("refreshExpenseEditFx");
      if(refresh)refresh.onclick=async()=>{
        const runtime=root.ARISE_CURRENCY_RUNTIME;
        if(!runtime||typeof runtime.refreshRates!=="function")return;
        refresh.disabled=true;
        try{await runtime.refreshRates(true);renderEditPreview(profile,tx);}catch(error){console.error("ARISE expense edit FX",error);toast("Не удалось обновить курс.");}finally{refresh.disabled=false;}
      };
      return;
    }

    const funding=editFunding(profile,tx,{amount:snap.baseAmount,date:draft.date,categoryId:draft.categoryId});
    const uncontrolled=safe(funding.uncontrolledAmount);
    const rows=candidates(profile,tx,{amount:snap.baseAmount,date:draft.date,categoryId:draft.categoryId});
    const full=rows.filter(row=>!row.current&&row.uncontrolled===0).slice(0,3);
    const partial=rows.filter(row=>!row.current&&row.uncontrolled>0&&row.controlled>0).slice(0,3);

    if(uncontrolled>0){
      preview.innerHTML=`<div class="notice warning"><strong>После изменения ${money(uncontrolled,snap.baseCurrency)} останутся неконтролируемыми.</strong><div class="tiny muted" style="margin-top:5px">Контролируемыми балансами покрывается ${money(funding.controlledAmount,snap.baseCurrency)}. Выбери другой источник или явно подтверди неконтролируемую часть.</div><label class="tiny" style="display:flex;gap:8px;align-items:flex-start;margin-top:10px"><input id="acceptExpenseEditUncontrolled" type="checkbox">Я подтверждаю ${money(uncontrolled,snap.baseCurrency)} как неконтролируемые средства.</label></div>${full.length?`<div class="notice" style="margin-top:10px"><strong>Можно объяснить расход полностью</strong><div class="actions" style="margin-top:9px">${full.map(row=>`<button type="button" class="btn small-btn" data-edit-expense-source="${esc(row.id||"")}">${esc(row.name)} · ${money(row.controlled,snap.baseCurrency)}</button>`).join("")}</div></div>`:partial.length?`<div class="notice" style="margin-top:10px"><strong>Более полное покрытие</strong><div class="actions" style="margin-top:9px">${partial.map(row=>`<button type="button" class="btn small-btn" data-edit-expense-source="${esc(row.id||"")}">${esc(row.name)} · покрывает ${money(row.controlled,snap.baseCurrency)}</button>`).join("")}</div></div>`:""}`;
      save.disabled=true;
      const accept=document.getElementById("acceptExpenseEditUncontrolled");
      if(accept)accept.onchange=()=>{save.disabled=!accept.checked;};
    }else{
      preview.innerHTML=`<div class="notice">После изменения расход полностью объясняется контролируемыми балансами. Неконтролируемых средств нет.</div>`;
      save.disabled=false;
    }

    preview.querySelectorAll("[data-edit-expense-source]").forEach(button=>{
      button.onclick=()=>{
        const select=document.getElementById("editExpenseCategory");
        if(select)select.value=button.dataset.editExpenseSource||"";
        renderEditPreview(profile,tx);
      };
    });
  }

  function applyEdit(profile,tx){
    const draft=formDraft();
    if(draft.originalAmount<=0)throw new Error("Сумма расхода должна быть больше нуля.");
    const snap=snapshot(profile,draft.originalAmount,draft.originalCurrency);
    if(snap.conversionPending)throw new Error("Для изменения расхода нужен актуальный или сохранённый курс.");
    const funding=editFunding(profile,tx,{amount:snap.baseAmount,date:draft.date,categoryId:draft.categoryId});
    const uncontrolled=safe(funding.uncontrolledAmount);
    const accepted=uncontrolled===0||document.getElementById("acceptExpenseEditUncontrolled")?.checked===true;
    if(!accepted)throw new Error("Подтверди неконтролируемую часть расхода или выбери другой источник.");
    const category=(profile.categories||[]).find(item=>String(item.id)===String(draft.categoryId));

    Object.assign(tx,{
      date:draft.date,
      month:monthKey(draft.date),
      amount:safe(snap.baseAmount),
      currency:snap.baseCurrency,
      originalAmount:safe(snap.originalAmount),
      originalCurrency:snap.originalCurrency,
      baseAmount:safe(snap.baseAmount),
      baseCurrency:snap.baseCurrency,
      exchangeRateToBase:snap.exchangeRateToBase,
      fxSource:snap.fxSource||null,
      fxFetchedAt:snap.fxFetchedAt||null,
      conversionPending:false,
      source:String(draft.source||"").trim(),
      note:String(draft.note||"").trim(),
      categoryId:draft.categoryId||null,
      categoryName:draft.categoryId?(category&&category.name||tx.categoryName||"Без категории"):"Нераспределено",
      fundingSource:funding.fundingSource,
      fundingSourceId:funding.fundingSourceId,
      controlledAmount:safe(funding.controlledAmount),
      categoryControlledAmount:safe(funding.categoryControlledAmount),
      unallocatedControlledAmount:safe(funding.unallocatedControlledAmount),
      uncontrolledAmount:uncontrolled,
      fundingBreakdown:{...(funding.fundingBreakdown||{})},
      reconciliationStatus:uncontrolled>0?"accepted_uncontrolled":"resolved",
      updatedAt:new Date().toISOString()
    });

    if(uncontrolled>0){
      tx.fundingBreakdown.acceptedUncontrolled=uncontrolled;
      tx.reconciliationAcceptedAt=new Date().toISOString();
    }else{
      delete tx.fundingBreakdown.acceptedUncontrolled;
      delete tx.reconciliationAcceptedAt;
    }
    return tx;
  }

  function showExpenseEditModal(transactionId){
    const profile=activeProfile();
    const tx=expenseById(profile,transactionId);
    if(!tx)return;
    const originalAmount=tx.originalAmount!=null?tx.originalAmount:tx.amount;
    const originalCurrency=tx.originalCurrency||tx.currency||profile.settings&&profile.settings.currency||"RUB";

    openModal(`
      <div class="kicker">РЕДАКТИРОВАНИЕ РАСХОДА</div>
      <h2 class="title">Сверить расход заново</h2>
      <div class="sub" style="margin-top:7px">ARISE временно возвращает исходный расход в доступные балансы и заново проверяет источник денег. Так редактирование не создаёт ложный перерасход.</div>
      <div class="form" style="margin-top:18px">
        <div class="field"><label>Сумма</label><input id="editExpenseAmount" type="number" min="1" value="${esc(originalAmount)}"></div>
        <div class="field"><label>Валюта</label><select id="editExpenseCurrency">${["RUB","EUR","USD"].map(code=>`<option value="${code}" ${code===originalCurrency?"selected":""}>${code}</option>`).join("")}</select></div>
        <div class="field"><label>Дата</label><input id="editExpenseDate" type="date" value="${esc(tx.date||today())}"></div>
        <div class="field"><label>Источник денег</label><select id="editExpenseCategory"><option value="">Нераспределено</option>${(profile.categories||[]).filter(category=>category.enabled!==false||String(category.id)===String(tx.categoryId)).map(category=>`<option value="${esc(category.id)}" ${String(category.id)===String(tx.categoryId)?"selected":""}>${esc(category.name||"Категория")}</option>`).join("")}</select></div>
        <div class="field"><label>Источник / описание</label><input id="editExpenseSource" value="${esc(tx.source||"")}"></div>
        <div class="field"><label>Комментарий</label><input id="editExpenseNote" value="${esc(tx.note||"")}"></div>
      </div>
      <div id="editExpensePreview" style="margin-top:14px"></div>
      <div class="actions"><button class="btn primary" id="saveExpenseEdit">Сохранить изменения</button><button class="btn" id="cancelExpenseEdit">Отмена</button></div>
    `);

    for(const id of ["editExpenseAmount","editExpenseCurrency","editExpenseDate","editExpenseCategory"]){
      const element=document.getElementById(id);
      if(element)element.addEventListener(id==="editExpenseAmount"?"input":"change",()=>renderEditPreview(profile,tx));
    }
    document.getElementById("cancelExpenseEdit").onclick=closeModal;
    document.getElementById("saveExpenseEdit").onclick=()=>{
      try{
        applyEdit(profile,tx);
        saveState();
        closeModal();
        activeMonth=monthKey(tx.date);
        toast("Расход обновлён и заново сверён с балансами.");
        render();
      }catch(error){toast(error.message||"Не удалось изменить расход.");}
    };
    renderEditPreview(profile,tx);
  }

  root.ARISE_EXPENSE_EDIT={showExpenseEditModal,applyEdit,editFunding,candidates,profileWithoutExpense,snapshot};
})(typeof globalThis!=="undefined"?globalThis:window);
