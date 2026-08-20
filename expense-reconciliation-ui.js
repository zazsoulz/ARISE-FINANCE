(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  const fundingApi=root.ARISE_EXPENSE_FUNDING;
  if(!core||!fundingApi||typeof fundingApi.expenseFunding!=="function")return;

  const previousShowExpenseModal=root.showExpenseModal;
  const previousCreateExpenseTransaction=root.createExpenseTransaction;
  const previousHistoryTransaction=root.historyTransaction;

  const safe=value=>Math.max(0,Math.round(Number(value)||0));

  function readDraft(){
    const amount=safe(document.getElementById("expenseAmount")?.value);
    const date=document.getElementById("expenseDate")?.value||today();
    const categoryId=document.getElementById("expenseCategory")?.value||null;
    return {amount,date,categoryId};
  }

  function sourceCandidates(profile,{amount,date,categoryId}){
    if(amount<=0)return [];
    const rows=[];
    const add=(id,name)=>{
      const funding=fundingApi.expenseFunding(profile,{amount,date,categoryId:id});
      rows.push({
        id:id||null,
        name,
        current:String(id||"")===String(categoryId||""),
        controlled:safe(funding.controlledAmount),
        uncontrolled:safe(funding.uncontrolledAmount),
        category:safe(funding.categoryControlledAmount),
        unallocated:safe(funding.unallocatedControlledAmount)
      });
    };

    add(null,"Нераспределено");
    for(const category of profile.categories||[]){
      if(category&&category.enabled!==false)add(category.id,category.name||"Категория");
    }

    return rows.sort((a,b)=>
      Number(b.uncontrolled===0)-Number(a.uncontrolled===0)||
      b.controlled-a.controlled||
      Number(a.current)-Number(b.current)||
      a.name.localeCompare(b.name,"ru")
    );
  }

  function coverageText(row){
    const parts=[];
    if(row.category>0)parts.push(`из категории ${money(row.category)}`);
    if(row.unallocated>0)parts.push(`из нераспределённого ${money(row.unallocated)}`);
    if(!parts.length&&row.controlled>0)parts.push(`подтверждено ${money(row.controlled)}`);
    return parts.join(" + ");
  }

  function decorateReconciliation(){
    const preview=document.getElementById("expensePreview");
    const select=document.getElementById("expenseCategory");
    if(!preview||!select)return;
    preview.querySelector("#expenseSourceOptions")?.remove();

    const profile=activeProfile();
    const draft=readDraft();
    if(draft.amount<=0)return;

    const current=fundingApi.expenseFunding(profile,draft);
    if(safe(current.uncontrolledAmount)<=0)return;

    const candidates=sourceCandidates(profile,draft);
    const alternatives=candidates.filter(row=>!row.current);
    const full=alternatives.filter(row=>row.uncontrolled===0);
    const partial=alternatives.filter(row=>row.uncontrolled>0&&row.controlled>0).slice(0,3);

    const panel=document.createElement("div");
    panel.id="expenseSourceOptions";
    panel.className="notice";
    panel.style.marginTop="10px";

    if(full.length){
      panel.innerHTML=`<strong>Можно объяснить расход полностью</strong><div class="tiny muted" style="margin-top:5px">Выбери подтверждённый источник — ARISE пересчитает операцию до сохранения.</div><div class="actions" style="margin-top:10px">${full.map(row=>`<button type="button" class="btn small-btn" data-expense-source-option="${escapeHTML(row.id||"")}"><span>${escapeHTML(row.name)}</span><span class="tiny muted">${escapeHTML(coverageText(row))}</span></button>`).join("")}</div>`;
    }else{
      panel.innerHTML=`<strong>Полного подтверждённого источника нет</strong><div class="tiny muted" style="margin-top:5px">Можно выбрать источник с максимальным покрытием, изменить сумму или явно принять оставшуюся часть как неконтролируемые средства.</div>${partial.length?`<div class="actions" style="margin-top:10px">${partial.map(row=>`<button type="button" class="btn small-btn" data-expense-source-option="${escapeHTML(row.id||"")}"><span>${escapeHTML(row.name)}</span><span class="tiny muted">покрывает ${money(row.controlled)} · не объяснено ${money(row.uncontrolled)}</span></button>`).join("")}</div>`:""}`;
    }

    preview.appendChild(panel);
    panel.querySelectorAll("[data-expense-source-option]").forEach(button=>{
      button.onclick=()=>{
        select.value=button.dataset.expenseSourceOption||"";
        select.dispatchEvent(new Event("change",{bubbles:true}));
      };
    });
  }

  function wrapDraftHandler(element,eventName){
    if(!element)return;
    const property=`on${eventName}`;
    const previous=element[property];
    element[property]=event=>{
      if(typeof previous==="function")previous.call(element,event);
      decorateReconciliation();
    };
  }

  if(typeof previousShowExpenseModal==="function"){
    root.showExpenseModal=function(){
      previousShowExpenseModal();
      wrapDraftHandler(document.getElementById("expenseAmount"),"input");
      wrapDraftHandler(document.getElementById("expenseCategory"),"change");
      wrapDraftHandler(document.getElementById("expenseDate"),"change");
      decorateReconciliation();
    };
  }

  if(typeof previousCreateExpenseTransaction==="function"){
    root.createExpenseTransaction=function(profile,data){
      const tx=previousCreateExpenseTransaction(profile,data);
      const uncontrolled=safe(tx&&tx.uncontrolledAmount);
      tx.fundingBreakdown={...(tx.fundingBreakdown||{})};
      if(uncontrolled>0){
        const accepted=typeof document!=="undefined"&&document.getElementById("acceptUncontrolledExpense")?.checked===true;
        tx.reconciliationStatus=accepted?"accepted_uncontrolled":"unresolved";
        if(accepted){
          tx.fundingBreakdown.acceptedUncontrolled=uncontrolled;
          tx.reconciliationAcceptedAt=new Date().toISOString();
        }
      }else{
        tx.reconciliationStatus="resolved";
      }
      return tx;
    };
  }

  root.historyTransaction=function(tx){
    const html=typeof previousHistoryTransaction==="function"?previousHistoryTransaction(tx):"";
    if(!tx||tx.type!=="expense"||tx.reconciliationStatus!=="accepted_uncontrolled")return html;
    const accepted=safe(tx.fundingBreakdown&&tx.fundingBreakdown.acceptedUncontrolled||tx.uncontrolledAmount);
    if(!accepted)return html;
    return html.replace(/(<\/div>\s*<\/div>\s*)$/,`<div class="tiny muted" style="margin-top:4px">Неконтролируемая часть ${money(accepted,tx.currency)} принята явно.</div>$1`);
  };

  root.ARISE_EXPENSE_RECONCILIATION_UI={sourceCandidates,decorateReconciliation,readDraft};
})(typeof globalThis!=="undefined"?globalThis:window);
