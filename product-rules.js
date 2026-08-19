(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  const reserveAnalytics=root.ARISE_RESERVE_ANALYTICS;

  function categoryName(profile,id){
    const current=(profile.categories||[]).find(item=>String(item.id)===String(id));
    if(current&&current.name) return current.name;
    for(const tx of profile.transactions||[]){
      for(const allocation of tx.allocations||[]){
        if(String(allocation.categoryId)===String(id)&&allocation.name) return allocation.name;
      }
      if(String(tx.categoryId)===String(id)&&tx.categoryName) return tx.categoryName;
    }
    return "Без категории";
  }

  function addCategoryDeleteControls(){
    const profile=activeProfile();
    document.querySelectorAll("[data-category-editor]").forEach(editor=>{
      if(editor.querySelector("[data-delete-category]")) return;
      const id=editor.dataset.categoryEditor;
      const actions=document.createElement("div");
      actions.className="actions";
      const button=document.createElement("button");
      button.type="button";
      button.className="btn small-btn danger";
      button.dataset.deleteCategory=id;
      button.textContent="Удалить категорию";
      button.onclick=()=>{
        const category=profile.categories.find(item=>String(item.id)===String(id));
        if(!category) return;
        if(!confirm(`Удалить категорию «${category.name}»? История операций сохранится.`)) return;
        profile.categories=profile.categories.filter(item=>String(item.id)!==String(id));
        saveState();
        toast("Категория удалена. История сохранена.");
        render();
      };
      actions.appendChild(button);
      editor.appendChild(actions);
    });
  }

  function guardFundedGoalDeletion(){
    const profile=activeProfile();
    document.querySelectorAll("[data-goal-delete]").forEach(button=>{
      const goalId=button.dataset.goalDelete;
      const goal=(profile.goals||[]).find(item=>String(item.id)===String(goalId));
      if(!goal) return;
      const balance=core.goalBalance(profile,goal);
      if(balance<=0) return;
      button.onclick=event=>{
        event.preventDefault();
        event.stopPropagation();
        toast(`В цели «${goal.name||"Без названия"}» есть ${money(balance)}. Сначала нужно выбрать, куда перевести эти деньги.`);
      };
      button.title="Нельзя удалить цель с деньгами без перевода баланса";
    });
  }

  function relabelSystemUnallocated(){
    const page=document.getElementById("page");
    if(!page) return;
    page.querySelectorAll(".stat-label").forEach(el=>{
      if(el.textContent.trim()==="СВОБОДНЫЕ") el.textContent="НЕ РАСПРЕДЕЛЕНО";
    });
    page.querySelectorAll(".kicker").forEach(el=>{
      if(el.textContent.trim()==="СВОБОДНЫЕ ДЕНЬГИ") el.textContent="НЕ РАСПРЕДЕЛЕНО";
    });
    page.querySelectorAll(".sub").forEach(el=>{
      if(el.innerHTML.includes("Свободные:")) el.innerHTML=el.innerHTML.replace(/Свободные:/g,"Не распределено:");
    });
  }

  function addReserveTargetControls(){
    const profile=activeProfile();
    const percent=document.getElementById("reservePercent");
    const saveButton=document.getElementById("saveReserve");
    if(!percent||!saveButton||document.getElementById("reserveTargetBalance")) return;

    profile.settings||={};
    profile.settings.reserve||={enabled:false,percent:0,limit:null};
    const reserve=profile.settings.reserve;
    const target=Math.max(0,integer(reserve.targetBalance||0));
    const balance=core.reserveBalance(profile);
    const form=percent.closest(".form");

    if(form){
      const field=document.createElement("div");
      field.className="field full";
      field.innerHTML=`
        <label>Целевой размер резерва</label>
        <input id="reserveTargetBalance" type="number" min="0" inputmode="numeric" value="${target||""}" placeholder="Например, 300000">
      `;
      form.appendChild(field);

      const status=document.createElement("div");
      status.id="reserveTargetStatus";
      status.className="notice";
      status.style.marginTop="14px";

      if(reserveAnalytics){
        const progress=reserveAnalytics.reserveProgress({reserveBalance:balance,targetBalance:target});
        if(progress.status==="ok"){
          status.innerHTML=`
            Сейчас в резерве <strong>${money(balance)}</strong> из <strong>${money(target)}</strong> · ${Math.round(progress.percent)}%.
            ${progress.complete?"Целевой размер достигнут.":`Осталось ${money(progress.remaining)}.`}
          `;
        }else{
          status.innerHTML=`Сейчас в резерве <strong>${money(balance)}</strong>. Задай целевой размер, чтобы ARISE показывал прогресс.`;
        }
      }else{
        status.innerHTML=`Сейчас в резерве <strong>${money(balance)}</strong>.`;
      }
      form.insertAdjacentElement("afterend",status);

      const runway=document.createElement("div");
      runway.className="sub";
      runway.style.marginTop="9px";
      runway.textContent="Запас в месяцах появится после того, как будет определено, какие расходы считать обязательными. ARISE не будет угадывать это за тебя.";
      status.insertAdjacentElement("afterend",runway);
    }

    const originalSave=saveButton.onclick;
    saveButton.onclick=()=>{
      const input=document.getElementById("reserveTargetBalance");
      const raw=input?input.value.trim():"";
      reserve.targetBalance=raw===""?null:Math.max(0,integer(raw));
      if(typeof originalSave==="function") originalSave();
      else{
        saveState();
        render();
      }
    };
  }

  root.monthStats=function(profile,month){
    const raw=core.monthStats(profile,month);
    const allocations={};

    for(const [id,value] of Object.entries(raw.categoryBalances||{})){
      const name=categoryName(profile,id);
      allocations[name]=(allocations[name]||0)+value;
    }

    for(const [id,value] of Object.entries(raw.goalAllocated||{})){
      const goal=(profile.goals||[]).find(item=>String(item.id)===String(id));
      const name=`Цель · ${goal&&goal.name?goal.name:"Без названия"}`;
      allocations[name]=(allocations[name]||0)+value;
    }

    return {
      income:raw.income,
      expenses:raw.expenses,
      reserve:raw.reserve,
      reserveWithdrawn:raw.reserveWithdrawn,
      allocations,
      operations:raw.operationCount,
      unallocated:raw.free,
      free:raw.free,
      uncontrolled:raw.uncontrolled,
      goalAllocated:raw.goalAllocated
    };
  };

  root.currentUnallocatedMoney=function(profile,month=activeMonth){
    return root.monthStats(profile,month).unallocated;
  };

  root.currentFreeMoney=function(profile,month=activeMonth){
    return root.currentUnallocatedMoney(profile,month);
  };

  const originalRenderHome=root.renderHome;
  root.renderHome=function(){
    originalRenderHome();
    relabelSystemUnallocated();
  };

  const originalRenderExpenses=root.renderExpenses;
  root.renderExpenses=function(){
    originalRenderExpenses();
    relabelSystemUnallocated();
  };

  const originalRenderGoals=root.renderGoals;
  root.renderGoals=function(){
    originalRenderGoals();
    guardFundedGoalDeletion();
  };

  const originalRenderHistory=root.renderHistory;
  root.renderHistory=function(){
    originalRenderHistory();
    relabelSystemUnallocated();
  };

  const originalShowExpenseModal=root.showExpenseModal;
  root.showExpenseModal=function(){
    originalShowExpenseModal();
    const option=document.querySelector('#expenseCategory option[value=""]');
    if(option) option.textContent="Нераспределено";
  };

  const originalUpdateExpensePreview=root.updateExpensePreview;
  root.updateExpensePreview=function(){
    originalUpdateExpensePreview();
    const preview=document.getElementById("expensePreview");
    if(!preview) return;
    preview.innerHTML=preview.innerHTML
      .replace(/свободные деньги/gi,"нераспределённый остаток")
      .replace(/свободными/gi,"нераспределёнными");
  };

  const originalExpenseRow=root.expenseRow;
  root.expenseRow=function(tx){
    const html=originalExpenseRow(tx);
    if(tx&&tx.categoryId) return html;
    return html.replace(/Свободные деньги/g,"Нераспределено");
  };

  const originalRenderIncomePlan=root.renderIncomePlan;
  root.renderIncomePlan=function(plan){
    originalRenderIncomePlan(plan);
    const label=document.querySelector("#incomePlan .plan-balance .label");
    if(label) label.textContent="НЕ РАСПРЕДЕЛЕНО";
  };

  const originalUpdateIncomePlanUI=root.updateIncomePlanUI;
  root.updateIncomePlanUI=function(plan){
    originalUpdateIncomePlanUI(plan);
    const message=document.getElementById("planMessage");
    if(message){
      message.innerHTML=message.innerHTML.replace(/В «Свободные деньги» перейдёт/g,"Останется не распределено");
    }
  };

  const originalShowGoalFundModal=root.showGoalFundModal;
  root.showGoalFundModal=function(goalId){
    originalShowGoalFundModal(goalId);
    const sheet=document.getElementById("sheet");
    if(!sheet) return;
    sheet.innerHTML=sheet.innerHTML
      .replace(/свободно сейчас/gi,"не распределено сейчас")
      .replace(/из свободных денег/gi,"из нераспределённого остатка")
      .replace(/свободных денег/gi,"нераспределённых денег")
      .replace(/свободными останется/gi,"останется не распределено");
  };

  const originalHistoryTransaction=root.historyTransaction;
  root.historyTransaction=function(tx){
    const html=originalHistoryTransaction(tx);
    if(tx&&tx.categoryId) return html;
    return html.replace(/Свободные деньги/g,"Нераспределено");
  };

  const originalRenderSettings=root.renderSettings;
  root.renderSettings=function(){
    originalRenderSettings();
    addCategoryDeleteControls();
    addReserveTargetControls();
  };

  root.ARISE_PRODUCT_RULES={
    addCategoryDeleteControls,
    currentUnallocatedMoney:root.currentUnallocatedMoney
  };
})(typeof globalThis!=="undefined"?globalThis:window);