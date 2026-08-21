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
