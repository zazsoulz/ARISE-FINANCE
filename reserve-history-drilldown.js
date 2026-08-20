(function(root){
  "use strict";

  const previousRenderSettings=root.renderSettings;
  if(typeof previousRenderSettings!=="function") return;

  const reserveTypes=new Set(["reserve_deposit","reserve_withdrawal"]);
  const esc=value=>escapeHTML(String(value??""));

  function reserveTransactions(profile){
    return (profile.transactions||[])
      .filter(tx=>reserveTypes.has(tx&&tx.type))
      .slice()
      .reverse()
      .slice(0,6);
  }

  function transferLabel(tx){
    const transfer=tx&&tx.fundingBreakdown&&tx.fundingBreakdown.transfer;
    if(!transfer) return "";
    const source=transfer.sourceAccount||tx.sourceAccount||"";
    const destination=transfer.destinationAccount||tx.destinationAccount||"";
    if(!source&&!destination) return "";
    return [source,destination].filter(Boolean).join(" → ");
  }

  function detailRow(label,value){
    if(value===null||typeof value==="undefined"||value==="") return "";
    return `<div class="history-detail-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function inspectReserveTransaction(profile,id){
    const tx=(profile.transactions||[]).find(item=>String(item.id)===String(id));
    if(!tx||!reserveTypes.has(tx.type)) return false;
    const currency=tx.originalCurrency||tx.currency||tx.baseCurrency||profile.settings?.currency||"RUB";
    const label=tx.type==="reserve_deposit"?"Пополнение резерва":"Вывод из резерва";
    const direction=tx.type==="reserve_deposit"?"В резерв":"Из резерва";
    openModal(`<div class="history-detail reserve-history-detail">
      <div class="kicker">ОПЕРАЦИЯ РЕЗЕРВА</div>
      <h2 class="title">${esc(label)}</h2>
      <div class="history-detail-amount">${esc(money(Number(tx.originalAmount??tx.amount)||0,currency))}</div>
      <div class="history-detail-list">
        ${detailRow("Направление",direction)}
        ${detailRow("Дата",formatDate(tx.date||""))}
        ${detailRow("Источник",tx.source||"")}
        ${detailRow("Перевод",transferLabel(tx))}
        ${detailRow("Комментарий",tx.note||"")}
        ${detailRow("ID",tx.id)}
      </div>
      <div class="actions"><button class="btn" type="button" data-reserve-history-close>Закрыть</button></div>
    </div>`);
    document.querySelector("[data-reserve-history-close]")?.addEventListener("click",closeModal);
    return true;
  }

  function bindReserveRows(profile){
    const section=document.getElementById("reserveLifecycle");
    if(!section) return 0;
    const rows=[...section.querySelectorAll(".row")];
    const transactions=reserveTransactions(profile);
    let bound=0;
    rows.forEach((row,index)=>{
      const tx=transactions[index];
      if(!tx) return;
      row.dataset.reserveHistoryTx=String(tx.id);
      row.setAttribute("role","button");
      row.setAttribute("tabindex","0");
      row.setAttribute("aria-label","Открыть операцию резерва");
      const open=()=>inspectReserveTransaction(profile,tx.id);
      row.addEventListener("click",open);
      row.addEventListener("keydown",event=>{
        if(event.key==="Enter"||event.key===" "){
          event.preventDefault();
          open();
        }
      });
      bound++;
    });
    return bound;
  }

  root.renderSettings=function(){
    const result=previousRenderSettings();
    bindReserveRows(activeProfile());
    return result;
  };

  root.ARISE_RESERVE_HISTORY_DRILLDOWN={reserveTransactions,transferLabel,inspectReserveTransaction,bindReserveRows};
})(typeof globalThis!=="undefined"?globalThis:window);
