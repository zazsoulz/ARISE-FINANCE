(function(root){
  "use strict";

  function decorate(row){
    if(!row||!root.ARISE_EXPENSE_EDIT||typeof root.ARISE_EXPENSE_EDIT.showExpenseEditModal!=="function")return;
    const profile=activeProfile();
    const tx=(profile.transactions||[]).find(item=>String(item.id)===String(row.dataset.historyTx));
    if(!tx||tx.type!=="expense")return;
    const actions=document.querySelector("#sheet .history-detail .actions");
    if(!actions||actions.querySelector("[data-history-edit-expense]"))return;
    const button=document.createElement("button");
    button.type="button";
    button.className="btn primary";
    button.dataset.historyEditExpense=tx.id;
    button.textContent="Редактировать расход";
    button.onclick=()=>root.ARISE_EXPENSE_EDIT.showExpenseEditModal(tx.id);
    actions.insertBefore(button,actions.firstChild);
  }

  if(typeof document!=="undefined"){
    document.addEventListener("click",event=>{
      const row=event.target&&event.target.closest&&event.target.closest("[data-history-tx]");
      if(row)setTimeout(()=>decorate(row),0);
    });
    document.addEventListener("keydown",event=>{
      if(event.key!=="Enter"&&event.key!==" ")return;
      const row=event.target&&event.target.closest&&event.target.closest("[data-history-tx]");
      if(row)setTimeout(()=>decorate(row),0);
    });
  }

  root.ARISE_HISTORY_EXPENSE_EDIT={decorate};
})(typeof globalThis!=="undefined"?globalThis:window);
