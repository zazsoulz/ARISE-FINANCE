(function(root){
  "use strict";

  function action(label,handler){
    const button=document.createElement("button");
    button.type="button";
    button.className="btn small-btn";
    button.textContent=label;
    button.onclick=handler;
    return button;
  }

  function navigate(page){
    activePage=page;
    render();
  }

  function markEmpty(el){
    if(!el||el.dataset.stateSemantics==="true")return;
    el.dataset.stateSemantics="true";
    el.setAttribute("role","status");
    el.setAttribute("aria-live","polite");
  }

  function enhanceEmpty(el,page){
    if(!el||el.dataset.stateEnhanced==="true")return;
    markEmpty(el);
    el.dataset.stateEnhanced="true";

    const actions=document.createElement("div");
    actions.className="actions state-actions";

    if(page==="income"){
      actions.appendChild(action("Добавить доход",()=>showIncomeModal()));
    }else if(page==="goals"){
      actions.appendChild(action("Создать цель",()=>showGoalModal()));
    }else if(page==="history"){
      actions.appendChild(action("Добавить доход",()=>showIncomeModal()));
      actions.appendChild(action("Добавить расход",()=>showExpenseModal()));
    }else if(page==="analytics"){
      actions.appendChild(action("Перейти к распределению",()=>navigate("income")));
    }

    if(actions.children.length)el.appendChild(actions);
  }

  function enhancePage(page){
    const rootEl=document.getElementById("page");
    if(!rootEl)return;
    const empties=[...rootEl.querySelectorAll(".empty")];
    if(!empties.length)return;

    // Every empty block gets consistent accessible status semantics.
    // Only the first page-level empty state receives primary recovery actions
    // so secondary cards stay concise and avoid repeated CTA clutter.
    empties.forEach(markEmpty);
    enhanceEmpty(empties[0],page);
  }

  function wrap(name,page){
    const previous=root[name];
    if(typeof previous!=="function")return;
    root[name]=function(){
      const result=previous.apply(this,arguments);
      enhancePage(page);
      return result;
    };
  }

  wrap("renderIncome","income");
  wrap("renderGoals","goals");
  wrap("renderHistory","history");
  wrap("renderAnalytics","analytics");

  root.ARISE_SCREEN_STATE_UI={markEmpty,enhanceEmpty,enhancePage};
})(typeof globalThis!=="undefined"?globalThis:window);
