(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  if(!core) return;

  const oldMonthStats=root.monthStats;
  if(typeof oldMonthStats==="function"){
    root.monthStats=function(profile,month){
      const stats=oldMonthStats(profile,month);
      if(stats&&stats.allocations&&Object.prototype.hasOwnProperty.call(stats.allocations,"Свободные деньги")){
        const value=stats.allocations["Свободные деньги"];
        delete stats.allocations["Свободные деньги"];
        stats.allocations["Не распределено"]=(stats.allocations["Не распределено"]||0)+value;
      }
      return stats;
    };
  }

  const oldRenderIncomePlan=root.renderIncomePlan;
  if(typeof oldRenderIncomePlan==="function"){
    root.renderIncomePlan=function(plan){
      oldRenderIncomePlan(plan);
      const label=document.querySelector("#incomePlan .plan-balance .label");
      if(label) label.textContent="НЕ РАСПРЕДЕЛЕНО ПОСЛЕ ПЛАНА";
      const notice=document.querySelector("#incomePlan > .notice");
      if(notice) notice.textContent="ARISE предлагает распределение по твоим правилам. Все суммы видны и их можно изменить до сохранения.";
    };
  }

  root.updateIncomePlanUI=function(plan){
    if(!currentIncomePlan) currentIncomePlan=clone(plan);
    const data=root.readIncomePlanFromUI();
    const validation=core.validatePlan({
      total:plan.total,
      allocations:data.allocations,
      goalAllocations:data.goalAllocations,
      reserve:data.reserve
    });
    const currency=document.getElementById("incomeCurrency").value;
    const differenceEl=document.getElementById("planDifference");
    if(differenceEl){
      differenceEl.textContent=money(validation.valid?validation.remainder:validation.difference,currency);
      differenceEl.className="value "+(validation.valid?"positive":"negative");
    }
    const message=document.getElementById("planMessage");
    if(!message) return;
    if(!validation.valid){
      message.innerHTML=`<div class="notice danger">Ты распределил больше дохода на <strong>${money(Math.abs(validation.difference),currency)}</strong>.</div>`;
    }else if(validation.remainder>0){
      message.innerHTML=`<div class="notice">После подтверждения останется <strong>${money(validation.remainder,currency)}</strong> не распределено. Остаток сохранится и перейдёт дальше.</div>`;
    }else{
      message.innerHTML=`<div class="notice">Распределение сходится. Можно сохранять.</div>`;
    }
  };

  const oldGoalFundModal=root.showGoalFundModal;
  if(typeof oldGoalFundModal==="function"){
    root.showGoalFundModal=function(goalId){
      oldGoalFundModal(goalId);
      const label=document.querySelector("#modal .field label");
      if(label&&/свободн/i.test(label.textContent||"")) label.textContent="Сумма из нераспределённого остатка";
      const sub=document.querySelector("#modal .sub");
      if(sub) sub.textContent=(sub.textContent||"").replace(/свободно сейчас/gi,"не распределено сейчас");
    };
  }

  const oldHistoryTransaction=root.historyTransaction;
  root.historyTransaction=function(tx){
    if(!tx||tx.type!=="expense"){
      return typeof oldHistoryTransaction==="function"?oldHistoryTransaction(tx):"";
    }

    const breakdown=tx.fundingBreakdown||{};
    const categoryAmount=Math.max(0,integer(breakdown.category??tx.categoryControlledAmount??0));
    const unallocatedAmount=Math.max(0,integer(breakdown.unallocated??tx.unallocatedControlledAmount??0));
    const uncontrolledAmount=Math.max(0,integer(breakdown.uncontrolled??tx.uncontrolledAmount??0));
    const parts=[];
    if(categoryAmount) parts.push(`${escapeHTML(tx.categoryName||"Категория")}: ${money(categoryAmount,tx.currency)}`);
    if(unallocatedAmount) parts.push(`Не распределено: ${money(unallocatedAmount,tx.currency)}`);
    if(uncontrolledAmount) parts.push(`Неконтролируемые: ${money(uncontrolledAmount,tx.currency)}`);

    return `<div class="row"><div class="row-left"><strong class="negative">- ${money(tx.amount,tx.currency)}</strong><div class="tiny muted">${escapeHTML(tx.source||"Без описания")} · ${formatDate(tx.date)}</div>${parts.length?`<div class="tiny muted" style="margin-top:4px">${parts.join(" · ")}</div>`:""}</div><div class="row-right"><div class="pill">Расход</div></div></div>`;
  };
})(typeof globalThis!=="undefined"?globalThis:window);
