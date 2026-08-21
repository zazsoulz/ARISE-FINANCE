(function(root){
  "use strict";

  const previousHome=root.renderHome;
  const previousHistory=root.renderHistory;

  const paths={
    home:'<path d="M3.5 10.2 12 3l8.5 7.2v9.3a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
    income:'<path d="M5 7h14M5 12h9M5 17h6"/><path d="m16 14 3 3 3-3M19 10v7"/>',
    goals:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 8v4l3 2"/>',
    history:'<path d="M4 5v5h5"/><path d="M5.2 15.5A8 8 0 1 0 5 8.7"/><path d="M12 7v5l3.2 2"/>',
    analytics:'<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    minus:'<path d="M5 12h14"/>',
    settings:'<circle cx="12" cy="12" r="3.2"/>'
  };

  function icon(name,size=18){return `<svg class="product-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||''}</svg>`;}

  function syncState(){
    if(typeof navigator!=="undefined"&&navigator.onLine===false)return {kind:'offline',label:'Офлайн',action:'Проверить сеть'};
    const sync=root.ARISE_SYNC&&root.ARISE_SYNC.lastResult?root.ARISE_SYNC.lastResult():null;
    if(sync&&sync.status==='conflict')return {kind:'conflict',label:'Нужен выбор',action:'Открыть конфликты'};
    if(sync&&sync.status==='error')return {kind:'error',label:'Ошибка синхронизации',action:'Повторить синхронизацию'};
    if(sync&&sync.status==='busy')return {kind:'syncing',label:'Синхронизация',action:'Синхронизация выполняется'};
    if(sync&&sync.status==='signed_out')return {kind:'local',label:'Только на устройстве',action:'Войдите, чтобы синхронизировать'};
    if(sync&&sync.status==='synced')return {kind:'online',label:'Синхронизировано',action:'Синхронизировать сейчас'};
    return {kind:'online',label:'Онлайн',action:'Синхронизировать сейчас'};
  }

  function applySyncIndicator(el,next=syncState()){
    if(!el)return;
    el.className=`product-sync ${next.kind}`;
    el.title=next.action||next.label;
    el.setAttribute('aria-label',next.action||next.label);
    el.setAttribute('aria-live','polite');
    el.disabled=next.kind==='syncing';
    const label=el.querySelector('span');if(label)label.textContent=next.label;
  }

  function updateSyncIndicator(){
    const el=typeof document!=="undefined"&&document.querySelector('.product-sync');
    applySyncIndicator(el);
  }

  async function retrySync(){
    const next=syncState();
    if(next.kind==='syncing')return false;
    if(next.kind==='offline'){
      if(typeof toast==='function')toast('Нет сети. Изменения сохранены на устройстве и синхронизируются после подключения.');
      return false;
    }
    if(next.kind==='local'){
      if(typeof toast==='function')toast('Войди в аккаунт, чтобы синхронизировать данные между устройствами.');
      return false;
    }
    if(next.kind==='conflict'){
      const conflictUI=root.ARISE_SYNC_CONFLICT_UI;
      if(conflictUI&&typeof conflictUI.showConflicts==='function')conflictUI.showConflicts();
      else if(typeof toast==='function')toast('Есть конфликт изменений. Открой конфликт синхронизации и выбери версию данных.');
      return false;
    }
    const sync=root.ARISE_SYNC;
    if(!sync||typeof sync.pushAll!=="function")return false;
    try{
      await sync.pushAll();
      updateSyncIndicator();
      return true;
    }catch(error){
      updateSyncIndicator();
      if(typeof toast==='function')toast('Не удалось синхронизировать. Локальные изменения сохранены — можно повторить позже.');
      return false;
    }
  }

  function modalIsOpen(){const modal=typeof document!=="undefined"&&document.getElementById('modal');return !!(modal&&modal.classList.contains('open'));}

  root.renderNav=function(){
    const items=[['home','Главная','home'],['income','Распределение','income'],['goals','Цели','goals'],['history','История','history'],['analytics','Аналитика','analytics']];
    return `<nav class="nav product-nav" aria-label="Основная навигация">${items.map(([id,label,glyph])=>`<button type="button" class="product-nav-item ${activePage===id?'active':''}" data-page="${id}" aria-label="${label}">${icon(glyph,17)}<span>${label}</span></button>`).join('')}</nav>`;
  };

  root.renderTopbar=function(){
    const account=state.account||{};
    const profile=typeof activeProfile==='function'?activeProfile():null;
    const letter=(account.name||'П').trim().slice(0,1).toUpperCase();
    const sync=syncState();
    return `<header class="topbar product-topbar"><div class="product-brand"><div class="logo">ARISE <span>FINANCE</span></div><div class="product-profile-name">${escapeHTML(profile&&profile.name||'Финансовый профиль')}</div></div><div class="user"><button type="button" class="product-sync ${sync.kind}" title="${escapeHTML(sync.action||sync.label)}" aria-label="${escapeHTML(sync.action||sync.label)}" ${sync.kind==='syncing'?'disabled':''}><i></i><span>${escapeHTML(sync.label)}</span></button><button class="avatar product-avatar" data-page="settings" aria-label="Настройки профиля">${account.avatar?`<img src="${escapeHTML(account.avatar)}" alt="">`:escapeHTML(letter)}</button></div></header>`;
  };

  function runQuick(action){if(modalIsOpen())return false;action();return true;}
  function bindQuickActions(scope){
    const income=scope&&scope.querySelector('[data-quick-income]');
    const expense=scope&&scope.querySelector('[data-quick-expense]');
    if(income)income.onclick=()=>runQuick(()=>showIncomeModal());
    if(expense)expense.onclick=()=>runQuick(()=>showExpenseModal());
  }

  root.renderHome=function(){
    if(typeof previousHome==='function')previousHome();
    const main=document.querySelector('.arise-v3-home');
    if(!main||main.querySelector('.product-quick-actions'))return;
    const income=main.querySelector('.arise-v3-income');
    const quick=document.createElement('section');
    quick.className='product-quick-actions';
    quick.setAttribute('aria-label','Быстрые финансовые действия');
    quick.innerHTML=`<button type="button" class="product-quick product-quick-income" data-quick-income>${icon('plus',19)}<span><strong>Доход</strong><small>Добавить поступление</small></span></button><button type="button" class="product-quick product-quick-expense" data-quick-expense>${icon('minus',19)}<span><strong>Расход</strong><small>Зафиксировать трату</small></span></button>`;
    if(income)income.insertAdjacentElement('afterend',quick);else main.prepend(quick);
    bindQuickActions(main);
  };

  root.renderHistory=function(){
    if(typeof previousHistory==='function')previousHistory();
    const income=document.getElementById('historyIncome');
    const expense=document.getElementById('historyExpense');
    if(income&&!income.querySelector('svg'))income.innerHTML=`${icon('plus',16)}<span>Доход</span>`;
    if(expense&&!expense.querySelector('svg'))expense.innerHTML=`${icon('minus',16)}<span>Расход</span>`;
  };

  if(root.addEventListener){
    root.addEventListener('online',updateSyncIndicator);
    root.addEventListener('offline',updateSyncIndicator);
    root.addEventListener('arise:sync',updateSyncIndicator);
    root.addEventListener('click',event=>{
      const button=event.target&&event.target.closest?event.target.closest('.product-sync'):null;
      if(!button)return;
      event.preventDefault();
      retrySync();
    });
  }

  root.ARISE_PRODUCT_UI={icon,syncState,applySyncIndicator,updateSyncIndicator,retrySync,modalIsOpen,runQuick,bindQuickActions};
})(typeof globalThis!=="undefined"?globalThis:window);

(function(root){
  "use strict";

  const amount=value=>Math.max(0,Math.round(Number(value)||0));

  function field(editor,selector){
    return editor.querySelector(selector)?.value ?? "";
  }

  function enabled(editor){
    return !!editor.querySelector(".category-enabled")?.checked;
  }

  function money(value){
    if(typeof root.money==="function") return root.money(amount(value));
    return new Intl.NumberFormat("ru-RU").format(amount(value))+" ₽";
  }

  function describe(editor){
    const type=field(editor,".category-type");
    const percent=amount(field(editor,".category-percent"));
    const fixed=amount(field(editor,".category-fixed"));
    const priority=Math.max(1,amount(field(editor,".category-priority"))||1);
    const rawLimit=field(editor,".category-limit");
    const limit=rawLimit===""?null:amount(rawLimit);

    if(!enabled(editor)){
      return {
        warning:true,
        title:"Категория выключена",
        text:"Новые доходы не будут направляться сюда автоматически. Уже сохранённые операции не меняются."
      };
    }

    let rule;
    if(type==="fixed"){
      rule=fixed>0
        ? `До ${money(fixed)} в месяц будет направляться сюда раньше процентных правил.`
        : "Фиксированная сумма равна нулю — автоматического пополнения по этому правилу не будет.";
    }else if(type==="percentage"){
      rule=percent>0
        ? `${percent}% будет распределяться с каждого нового дохода в рамках месяца.`
        : "Процент равен нулю — автоматического пополнения по этому правилу не будет.";
    }else{
      rule="Это правило получает только остаток после остальных распределений.";
    }

    const cap=limit===null
      ? " Месячный лимит не задан."
      : ` После ${money(limit)} за месяц автоматическое пополнение остановится до следующего месяца.`;

    const priorityText=priority>=5
      ? " Высокий приоритет: при нехватке денег это правило обслуживается раньше большинства остальных."
      : priority<=2
        ? " Низкий приоритет: при нехватке денег более важные правила могут получить средства раньше."
        : " Приоритет влияет на очередь распределения, когда денег недостаточно для всех правил.";

    return {warning:false,title:"Что изменит это правило",text:rule+cap+priorityText};
  }

  function ensurePreview(editor){
    let preview=editor.querySelector(".category-consequence");
    if(preview) return preview;
    preview=document.createElement("div");
    preview.className="category-consequence notice";
    preview.style.marginTop="12px";
    const check=editor.querySelector(".check");
    if(check) check.insertAdjacentElement("beforebegin",preview);
    else editor.appendChild(preview);
    return preview;
  }

  function refresh(editor){
    const info=describe(editor);
    const preview=ensurePreview(editor);
    preview.className="category-consequence notice"+(info.warning?" warning":"");
    preview.innerHTML=`<strong>${info.title}</strong><div class="tiny muted" style="margin-top:5px;line-height:1.55">${info.text}</div>`;

    const type=field(editor,".category-type");
    const percentField=editor.querySelector(".category-percent")?.closest(".field");
    const fixedField=editor.querySelector(".category-fixed")?.closest(".field");
    if(percentField) percentField.style.display=type==="percentage"?"":"none";
    if(fixedField) fixedField.style.display=type==="fixed"?"":"none";
  }

  function bind(scope=document){
    scope.querySelectorAll("[data-category-editor]").forEach(editor=>{
      if(editor.dataset.consequenceBound==="1"){
        refresh(editor);
        return;
      }
      editor.dataset.consequenceBound="1";
      [".category-type",".category-percent",".category-fixed",".category-priority",".category-limit",".category-enabled"].forEach(selector=>{
        const control=editor.querySelector(selector);
        if(!control) return;
        control.addEventListener("input",()=>refresh(editor));
        control.addEventListener("change",()=>refresh(editor));
      });
      refresh(editor);
    });
  }

  const oldRenderSettings=root.renderSettings;
  if(typeof oldRenderSettings==="function"){
    root.renderSettings=function(){
      const result=oldRenderSettings.apply(this,arguments);
      bind(document);
      return result;
    };
  }

  root.ARISE_CATEGORY_SETTINGS_CONSEQUENCES={describe,bind};
})(typeof globalThis!=="undefined"?globalThis:window);

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
