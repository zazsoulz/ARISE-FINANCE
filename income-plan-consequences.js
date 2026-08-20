(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  const previousUpdate=root.updateIncomePlanUI;
  if(!core||typeof previousUpdate!=="function"||typeof root.readIncomePlanFromUI!=="function")return;

  const safe=value=>Math.max(0,Math.round(Number(value)||0));
  const signed=(value,currency)=>`${value>0?"+":"−"}${money(Math.abs(value),currency)}`;

  function goalById(profile,id){return (profile.goals||[]).find(goal=>String(goal.id)===String(id));}
  function amountById(rows,key,id){const row=(rows||[]).find(item=>String(item&&item[key])===String(id));return safe(row&&row.amount);}

  function deadlineConsequence(profile,goal,date,originalAmount,editedAmount,currency){
    if(!goal||!goal.deadline||originalAmount===editedAmount)return null;
    const status=core.goalDeadlineStatus(profile,goal,date,goal.monthlyContribution);
    if(!Number.isFinite(status.months)||status.months<=0)return null;
    const balance=safe(core.goalBalance(profile,goal));
    const target=safe(goal.target);
    const originalRemaining=Math.max(0,target-balance-originalAmount);
    const editedRemaining=Math.max(0,target-balance-editedAmount);
    const originalNeed=Math.ceil(originalRemaining/status.months);
    const editedNeed=Math.ceil(editedRemaining/status.months);
    if(originalNeed===editedNeed)return null;
    const direction=editedNeed>originalNeed?"вырастет":"снизится";
    return `Для цели «${goal.name||"Цель"}» требуемый средний темп до дедлайна ${direction}: ${money(originalNeed,currency)}/мес. → ${money(editedNeed,currency)}/мес.`;
  }

  function reserveTargetConsequence(profile,originalAmount,editedAmount,currency){
    const analytics=root.ARISE_RESERVE_ANALYTICS;
    const target=safe(profile.settings?.reserve?.targetBalance);
    if(originalAmount===editedAmount||target<=0||!analytics||typeof analytics.reserveProgress!=="function"||typeof core.reserveBalance!=="function")return null;
    const balance=safe(core.reserveBalance(profile));
    const before=analytics.reserveProgress({reserveBalance:balance+safe(originalAmount),targetBalance:target});
    const after=analytics.reserveProgress({reserveBalance:balance+safe(editedAmount),targetBalance:target});
    if(before.status!=="ok"||after.status!=="ok")return null;
    const beforePercent=Math.round(before.percent);
    const afterPercent=Math.round(after.percent);
    if(beforePercent===afterPercent&&before.remaining===after.remaining)return null;
    return `Прогресс подушки после этого дохода: ${beforePercent}% → ${afterPercent}%; до цели останется ${money(before.remaining,currency)} → ${money(after.remaining,currency)}.`;
  }

  function consequences(plan,edited){
    const profile=activeProfile();
    const currency=plan.baseCurrency||profile.settings?.currency||"RUB";
    const date=plan.date||today();
    const rows=[];

    for(const original of plan.goalAllocations||[]){
      const goal=goalById(profile,original.goalId);
      const before=safe(original.amount);
      const after=amountById(edited.goalAllocations,"goalId",original.goalId);
      if(before===after)continue;
      const delta=after-before;
      rows.push(`${goal&&goal.name?`Цель «${goal.name}»`:"Цель"}: ${signed(delta,currency)} относительно предложения ARISE.`);
      const deadline=deadlineConsequence(profile,goal,date,before,after,currency);
      if(deadline)rows.push(deadline);
    }

    for(const original of plan.allocations||[]){
      const before=safe(original.amount);
      const after=amountById(edited.allocations,"categoryId",original.categoryId);
      if(before===after)continue;
      rows.push(`Категория «${original.name||"Категория"}»: ${signed(after-before,currency)} относительно предложения.`);
    }

    const reserveBefore=safe(plan.reserve);
    const reserveAfter=safe(edited.reserve);
    if(reserveBefore!==reserveAfter){
      const delta=reserveAfter-reserveBefore;
      rows.push(`Финансовая подушка получит ${signed(delta,currency)} относительно предложения${delta<0?" — резерв будет расти медленнее":" — резерв будет расти быстрее"}.`);
      const targetConsequence=reserveTargetConsequence(profile,reserveBefore,reserveAfter,currency);
      if(targetConsequence)rows.push(targetConsequence);
    }

    const validation=core.validatePlan({total:plan.total,allocations:edited.allocations,goalAllocations:edited.goalAllocations,reserve:edited.reserve});
    if(validation.valid){
      const before=safe(plan.remainder);
      const after=safe(validation.remainder);
      if(before!==after)rows.push(`Нераспределённый остаток: ${money(before,currency)} → ${money(after,currency)} (${signed(after-before,currency)}).`);
    }
    return rows;
  }

  function render(plan){
    const message=document.getElementById("planMessage");
    if(!message||!plan||plan.fxPending)return;
    message.parentElement?.querySelector("#planConsequences")?.remove();
    const edited=root.readIncomePlanFromUI();
    const rows=consequences(plan,edited);
    if(!rows.length)return;
    const panel=document.createElement("div");
    panel.id="planConsequences";
    panel.className="notice";
    panel.style.marginTop="10px";
    panel.innerHTML=`<strong>Что изменится</strong><div class="tiny muted" style="margin-top:6px">ARISE ничего не меняет скрыто — это последствия твоего текущего варианта.</div><div style="display:grid;gap:6px;margin-top:9px">${rows.map(text=>`<div>${escapeHTML(text)}</div>`).join("")}</div>`;
    message.insertAdjacentElement("afterend",panel);
  }

  root.updateIncomePlanUI=function(plan){
    const result=previousUpdate(plan);
    render(plan);
    return result;
  };

  root.ARISE_INCOME_PLAN_CONSEQUENCES={consequences,deadlineConsequence,reserveTargetConsequence,render};
})(typeof globalThis!=="undefined"?globalThis:window);
