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
    settings:'<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1H9.55a1.7 1.7 0 0 0-.4-1.1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 3.75 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4V9.55a1.7 1.7 0 0 0 1.1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.86-2.86.06.06A1.7 1.7 0 0 0 8.15 3.75a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1h4.05a1.7 1.7 0 0 0 .4 1.1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.15c.14.4.35.74.6 1 .3.3.67.43 1.1.4v4.05c-.43-.03-.8.1-1.1.4-.25.26-.46.6-.6 1Z"/>'
  };

  function icon(name,size=18){
    return `<svg class="product-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||''}</svg>`;
  }

  function syncState(){
    if(typeof navigator!=="undefined"&&navigator.onLine===false)return {kind:'offline',label:'Офлайн'};
    const sync=root.ARISE_SYNC&&root.ARISE_SYNC.lastResult?root.ARISE_SYNC.lastResult():null;
    if(sync&&sync.status==='error')return {kind:'error',label:'Ошибка синхронизации'};
    if(sync&&sync.status==='synced')return {kind:'online',label:'Синхронизировано'};
    return {kind:'online',label:'Онлайн'};
  }

  root.renderNav=function(){
    const items=[['home','Главная','home'],['income','Распределение','income'],['goals','Цели','goals'],['history','История','history'],['analytics','Аналитика','analytics']];
    return `<nav class="nav product-nav" aria-label="Основная навигация">${items.map(([id,label,glyph])=>`<button type="button" class="product-nav-item ${activePage===id?'active':''}" data-page="${id}" aria-label="${label}">${icon(glyph,17)}<span>${label}</span></button>`).join('')}</nav>`;
  };

  root.renderTopbar=function(){
    const account=state.account||{};
    const profile=typeof activeProfile==='function'?activeProfile():null;
    const letter=(account.name||'П').trim().slice(0,1).toUpperCase();
    const sync=syncState();
    return `<header class="topbar product-topbar"><div class="product-brand"><div class="logo">ARISE <span>FINANCE</span></div><div class="product-profile-name">${escapeHTML(profile&&profile.name||'Финансовый профиль')}</div></div><div class="user"><div class="product-sync ${sync.kind}" title="${escapeHTML(sync.label)}"><i></i><span>${escapeHTML(sync.label)}</span></div><button class="avatar product-avatar" data-page="settings" aria-label="Настройки профиля">${account.avatar?`<img src="${escapeHTML(account.avatar)}" alt="">`:escapeHTML(letter)}</button></div></header>`;
  };

  function bindQuickActions(scope){
    const income=scope&&scope.querySelector('[data-quick-income]');
    const expense=scope&&scope.querySelector('[data-quick-expense]');
    if(income)income.onclick=()=>showIncomeModal();
    if(expense)expense.onclick=()=>showExpenseModal();
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

  root.ARISE_PRODUCT_UI={icon,syncState,bindQuickActions};
})(typeof globalThis!=="undefined"?globalThis:window);
