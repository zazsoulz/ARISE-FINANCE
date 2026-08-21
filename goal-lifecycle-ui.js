(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  if(!core)return;

  const previousShowGoalModal=root.showGoalModal;
  const previousRenderGoals=root.renderGoals;
  const previousHistoryTransaction=root.historyTransaction;

  const safe=value=>Math.max(0,Math.round(Number(value)||0));
  const goalById=(profile,id)=>(profile.goals||[]).find(goal=>String(goal.id)===String(id));

  function ensureLedgerStart(goal){
    if(goal&&!Number.isFinite(Number(goal.ledgerStart)))goal.ledgerStart=safe(goal.current);
  }

  function destinationLabel(value,profile){
    if(value==="reserve")return "в резерв";
    if(String(value||"").startsWith("goal:")){
      const goal=goalById(profile,String(value).slice(5));
      return goal?`в цель «${goal.name}»`:"в другую цель";
    }
    return "в нераспределённый остаток";
  }

  function syncGoalStatus(profile,goal){
    if(!goal||goal.status==="closed")return;
    const balance=core.goalBalance(profile,goal);
    goal.current=balance;
    if(safe(goal.target)>0&&balance>=safe(goal.target)){
      goal.status="completed";
      goal.completedAt||=today();
    }else{
      goal.status="active";
      goal.completedAt="";
    }
  }

  function closeGoal(profile,goal,destination){
    ensureLedgerStart(goal);
    const balance=core.goalBalance(profile,goal);
    const date=today();
    const currency=profile.settings&&profile.settings.currency||"RUB";
    const created=[];

    if(balance>0){
      if(String(destination).startsWith("goal:")){
        const targetGoalId=String(destination).slice(5);
        const pair=core.createGoalTransfer(profile,{
          goalId:goal.id,targetGoalId,amount:balance,date,currency,
          withdrawalId:uid(),contributionId:uid(),note:`Закрытие цели «${goal.name||"Цель"}»`
        });
        created.push(pair.withdrawal,pair.contribution);
      }else{
        created.push(core.createGoalWithdrawal(profile,{
          id:uid(),goalId:goal.id,amount:balance,destinationAccount:destination||"free",date,currency,
          note:`Закрытие цели «${goal.name||"Цель"}»`
        }));
      }
    }

    const timestamp=new Date().toISOString();
    for(const tx of created){tx.createdAt=timestamp;profile.transactions.push(tx);}

    goal.status="closed";
    goal.autoAllocate=false;
    goal.closedAt=date;
    goal.closureBalance=balance;
    goal.closureDestination=destination||"free";
    goal.current=core.goalBalance(profile,goal);

    if(String(destination).startsWith("goal:"))syncGoalStatus(profile,goalById(profile,String(destination).slice(5)));
    return created;
  }

  function showGoalCloseModal(goalId){
    const profile=activeProfile();
    const goal=goalById(profile,goalId);
    if(!goal||goal.status==="closed")return;
    ensureLedgerStart(goal);
    const balance=core.goalBalance(profile,goal);
    const eligibleTargets=(profile.goals||[]).filter(target=>
      String(target.id)!==String(goal.id)&&target.status!=="closed"&&target.status!=="completed"&&core.goalRemaining(profile,target)>=balance
    );

    openModal(`
      <div class="kicker">ЗАКРЫТИЕ ЦЕЛИ</div>
      <h2 class="title">${escapeHTML(goal.name||"Цель")}</h2>
      <div class="sub" style="margin-top:8px">${balance>0?`В цели сейчас ${money(balance)}. ARISE не удалит эти деньги — выбери, куда перевести весь остаток.`:"В цели нет денег. История останется, а цель перестанет участвовать в распределении."}</div>
      ${balance>0?`<div class="field" style="margin-top:18px"><label>Куда перевести ${money(balance)}</label><select id="goalCloseDestination"><option value="free">В нераспределённый остаток</option><option value="reserve">В резерв</option>${eligibleTargets.map(target=>`<option value="goal:${escapeHTML(target.id)}">В цель · ${escapeHTML(target.name||"Цель")}</option>`).join("")}</select></div>`:""}
      <div class="notice" style="margin-top:14px">Все прошлые пополнения и операции цели останутся в истории. Закрытая цель больше не получает автоматические распределения.</div>
      <div class="actions"><button class="btn danger" id="confirmGoalClose">Закрыть цель</button><button class="btn" id="cancelGoalClose">Отмена</button></div>
    `);

    document.getElementById("cancelGoalClose").onclick=closeModal;
    document.getElementById("confirmGoalClose").onclick=()=>{
      const destination=document.getElementById("goalCloseDestination")?.value||"free";
      try{
        closeGoal(profile,goal,destination);
        saveState();
        closeModal();
        toast(balance>0?`Цель закрыта. ${money(balance)} переведены ${destinationLabel(destination,profile)}.`:"Цель закрыта. История сохранена.");
        render();
      }catch(error){toast(error.message||"Не удалось закрыть цель.");}
    };
  }

  if(typeof previousShowGoalModal==="function"){
    root.showGoalModal=function(goalId){
      previousShowGoalModal(goalId);
      if(!goalId)return;
      const profile=activeProfile();
      const goal=goalById(profile,goalId);
      if(!goal||goal.status==="closed")return;

      const current=document.getElementById("goalCurrent");
      if(current){
        const balance=core.goalBalance(profile,goal);
        current.value=String(balance);
        if(Number.isFinite(Number(goal.ledgerStart))){
          current.disabled=true;
          const label=current.closest(".field")?.querySelector("label");
          if(label)label.textContent="Накоплено по операциям";
          current.closest(".field")?.insertAdjacentHTML("beforeend",'<div class="tiny muted" style="margin-top:6px">Баланс этой цели считается по истории операций и не редактируется вручную.</div>');
        }
      }

      const actions=document.querySelector("#sheet .actions");
      if(actions&&!actions.querySelector("[data-close-funded-goal]")){
        const button=document.createElement("button");
        button.type="button";button.className="btn danger";button.dataset.closeFundedGoal=goal.id;button.textContent="Закрыть цель";
        button.onclick=()=>showGoalCloseModal(goal.id);
        actions.appendChild(button);
      }
    };
  }

  if(typeof previousRenderGoals==="function"){
    root.renderGoals=function(){
      previousRenderGoals();
      const profile=activeProfile();
      const page=document.getElementById("page");
      if(!page)return;
      const active=(profile.goals||[]).filter(goal=>goal.status!=="completed"&&goal.status!=="closed");
      const total=active.reduce((sum,goal)=>sum+safe(core.goalBalance(profile,goal)),0);
      const heading=page.querySelector(".v3-page-head h1");
      const meta=page.querySelector(".v3-page-head p");
      if(heading)heading.textContent=money(total);
      if(meta)meta.textContent=`${active.length} ${active.length===1?"активная цель":"активных целей"}`;
      page.querySelectorAll("[data-goal-id]").forEach(article=>{
        const goal=goalById(profile,article.dataset.goalId);
        if(goal&&goal.status==="closed")article.remove();
      });

      const completed=(profile.goals||[]).filter(goal=>goal.status==="completed");
      const completedSection=page.querySelector("[data-completed-goals]")||[...page.querySelectorAll(".v3-section")].find(section=>/Достигнутые/i.test(section.textContent||""));
      if(completedSection){
        const rows=[...completedSection.querySelectorAll(".v3-rule")];
        completed.forEach((goal,index)=>{
          const row=rows.find(item=>String(item.dataset.completedGoalId||"")===String(goal.id))||rows[index];
          if(!row)return;
          row.classList.add("goal-completed-row");
          let actions=row.querySelector(".goal-completed-actions");
          if(!actions){actions=document.createElement("div");actions.className="goal-completed-actions";row.appendChild(actions);}
          const button=document.createElement("button");button.type="button";button.className="btn small-btn goal-completed-close";button.dataset.closeCompletedGoal=goal.id;button.textContent="Закрыть цель";button.setAttribute("aria-label",`Закрыть цель «${goal.name||"Цель"}»`);button.onclick=()=>showGoalCloseModal(goal.id);actions.appendChild(button);
        });
      }

      const closed=(profile.goals||[]).filter(goal=>goal.status==="closed");
      if(closed.length){
        page.insertAdjacentHTML("beforeend",`<section class="v3-section goal-closed-section"><div class="v3-section-title"><span>Закрытые</span><b>${closed.length}</b></div>${closed.map(goal=>`<div class="v3-rule"><div><strong>${escapeHTML(goal.name||"Цель")}</strong><span>${formatDate(goal.closedAt)} · ${escapeHTML(destinationLabel(goal.closureDestination,profile))}</span></div><b>${money(goal.closureBalance||0)}</b></div>`).join("")}</section>`);
      }
    };
  }

  root.historyTransaction=function(tx){
    if(tx&&tx.type==="goal_withdrawal"){
      const profile=activeProfile();
      const destination=tx.destinationAccount==="goal"?`goal:${tx.targetGoalId}`:tx.destinationAccount;
      return `<div class="row"><div class="row-left"><strong class="negative">- ${money(tx.amount,tx.currency)}</strong><div class="tiny muted">Вывод из цели · ${escapeHTML(tx.goalName||"Цель")} · ${escapeHTML(destinationLabel(destination,profile))} · ${formatDate(tx.date)}</div></div><div class="row-right"><div class="pill">Цель</div></div></div>`;
    }
    if(tx&&tx.type==="goal_contribution"&&tx.sourceAccount==="goal"){
      return `<div class="row"><div class="row-left"><strong>${money(tx.amount,tx.currency)}</strong><div class="tiny muted">Перевод из другой цели · ${escapeHTML(tx.goalName||"Цель")} · ${formatDate(tx.date)}</div></div><div class="row-right"><div class="pill">Цель</div></div></div>`;
    }
    return typeof previousHistoryTransaction==="function"?previousHistoryTransaction(tx):"";
  };

  root.ARISE_GOAL_LIFECYCLE={showGoalCloseModal,closeGoal,ensureLedgerStart,destinationLabel};
})(typeof globalThis!=="undefined"?globalThis:window);
