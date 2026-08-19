(function(root){
  "use strict";

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

  function relabelSystemUnallocated(){
    const page=document.getElementById("page");
    if(!page) return;
    page.querySelectorAll(".stat-label").forEach(el=>{
      if(el.textContent.trim()==="СВОБОДНЫЕ") el.textContent="НЕ РАСПРЕДЕЛЕНО";
    });
    page.querySelectorAll(".kicker").forEach(el=>{
      if(el.textContent.trim()==="СВОБОДНЫЕ ДЕНЬГИ") el.textContent="НЕ РАСПРЕДЕЛЕНО";
    });
  }

  const originalMonthStats=root.monthStats;
  root.monthStats=function(profile,month){
    const stats=originalMonthStats(profile,month);
    if(stats.allocations&&Object.prototype.hasOwnProperty.call(stats.allocations,"Свободные деньги")){
      delete stats.allocations["Свободные деньги"];
    }
    stats.unallocated=stats.free;
    return stats;
  };

  root.currentUnallocatedMoney=function(profile,month=activeMonth){
    return root.monthStats(profile,month).unallocated;
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
  };

  root.ARISE_PRODUCT_RULES={
    addCategoryDeleteControls,
    currentUnallocatedMoney:root.currentUnallocatedMoney
  };
})(typeof globalThis!=="undefined"?globalThis:window);
