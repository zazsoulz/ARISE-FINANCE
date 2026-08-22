(function(root){
  "use strict";

  function enhanceAccountSettings(){
    const module=root.ARISE_ACCOUNT_SETTINGS;
    if(module&&typeof module.enhanceSettings==="function") module.enhanceSettings();
  }

  function enhanceProfileSettings(){
    const module=root.ARISE_PROFILE_LIFECYCLE;
    if(module&&typeof module.enhanceSettings==="function") module.enhanceSettings();
  }

  function renderSettings(){
    const profile=activeProfile();
    const page=document.getElementById("page");
    if(!page) return;

    page.innerHTML=`
      ${profileSwitcher()}
      <div class="grid">
        <div class="c6"><section class="card">
          <div class="kicker">ПРОФИЛЬ</div><h2 class="title">Основные настройки</h2>
          <div class="form" style="margin-top:17px">
            <div class="field full"><label>Название профиля</label><input id="settingsProfileName" value="${escapeHTML(profile.name)}"></div>
            <div class="field"><label>Основная валюта</label><select id="settingsCurrency">${Object.entries(CURRENCIES).map(([code,data])=>`<option value="${code}" ${profile.settings.currency===code?"selected":""}>${data.name} (${data.symbol})</option>`).join("")}</select></div>
            <div class="field"><label>Источник дохода по умолчанию</label><input id="defaultSource" value="${escapeHTML(profile.settings.defaultIncomeSource||"")}" placeholder="Зарплата"></div>
          </div>
          <div class="actions"><button class="btn primary" id="saveProfileSettings">Сохранить</button></div>
        </section></div>

        <div class="c6"><section class="card">
          <div class="kicker">АККАУНТ</div><h2 class="title">Владелец</h2>
          <div class="form" style="margin-top:17px">
            <div class="field full"><label>Имя</label><input id="accountName" value="${escapeHTML(state.account.name)}"></div>
            <div class="field full"><label>Фотография</label><div style="display:flex;align-items:center;gap:15px;flex-wrap:wrap">
              ${state.account.avatar?`<img src="${escapeHTML(state.account.avatar)}" alt="Фото профиля" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.12)">`:`<div style="width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);color:var(--muted)">?</div>`}
              <label class="btn" style="cursor:pointer">Изменить фото<input id="accountAvatar" type="file" accept="image/*" style="display:none"></label>
            </div></div>
          </div>
          <div class="actions"><button class="btn" id="saveAccount">Сохранить аккаунт</button></div>
        </section></div>

        <div class="c12"><section class="card">
          <div class="kicker">СИСТЕМА РАСПРЕДЕЛЕНИЯ</div><h2 class="title">Категории</h2>
          <div class="sub" style="margin-top:7px">Это ядро финансовой логики. ARISE сначала выполняет фиксированные правила, затем процентные, а остаток оставляет не распределённым.</div>
          <div id="categoryEditors" style="margin-top:17px">${profile.categories.map(categoryEditor).join("")}</div>
          <div class="actions"><button class="btn" id="addCategory">+ Категория</button><button class="btn primary" id="saveCategories">Сохранить категории</button></div>
        </section></div>

        <div class="c6"><section class="card">
          <div class="kicker">РЕЗЕРВ</div><h2 class="title">Финансовая подушка</h2>
          <div class="form" style="margin-top:17px">
            <div class="field"><label>Процент от дохода</label><select id="reservePercent">${PERCENTAGES.map(p=>`<option value="${p}" ${number(profile.settings.reserve.percent)===p?"selected":""}>${p}%</option>`).join("")}</select></div>
            <div class="field"><label>Максимум на один доход</label><input id="reserveLimit" type="number" value="${profile.settings.reserve.limit??""}" placeholder="Без лимита"></div>
          </div>
          <label class="check"><input id="reserveEnabled" type="checkbox" ${profile.settings.reserve.enabled?"checked":""}> Использовать резерв при каждом доходе</label>
          <div class="actions"><button class="btn primary" id="saveReserve">Сохранить резерв</button></div>
        </section></div>

        <div class="c6"><section class="card">
          <div class="kicker">ПРОФИЛИ</div><h2 class="title">Финансовые сценарии</h2>
          <div class="sub" style="margin-top:7px">Каждый профиль имеет собственные доходы, расходы, цели и правила.</div>
          <div style="margin-top:13px">${state.profiles.map(p=>`<div class="row"><div><strong>${escapeHTML(p.name)}</strong><div class="tiny muted">${p.id===state.activeProfileId?"Текущий профиль":p.transactions.length+" операций"}</div></div><div class="actions" style="margin:0">${p.id===state.activeProfileId?"":`<button class="btn small-btn" data-open-profile="${p.id}">Открыть</button>`}${state.profiles.length>1?`<button class="btn small-btn danger" data-delete-profile="${p.id}">Удалить</button>`:""}</div></div>`).join("")}</div>
          <div class="actions"><button class="btn" id="newProfile">+ Новый профиль</button></div>
        </section></div>

        <div class="c12"><section class="card">
          <div class="kicker">ДАННЫЕ</div><h2 class="title">Резервная копия</h2>
          <div class="sub">ARISE хранит локальную копию данных на устройстве. Здесь можно экспортировать её или восстановить позже.</div>
          <div class="actions"><button class="btn" id="exportData">Экспорт JSON</button><label class="btn" style="cursor:pointer">Импорт JSON<input id="importData" type="file" accept=".json,application/json" style="display:none"></label><button class="btn danger" id="resetData">Сбросить всё</button></div>
        </section></div>
      </div>`;

    bindProfileSwitcher();

    document.getElementById("saveProfileSettings").onclick=()=>{
      profile.name=document.getElementById("settingsProfileName").value.trim()||"Мой профиль";
      profile.settings.currency=document.getElementById("settingsCurrency").value;
      profile.settings.defaultIncomeSource=document.getElementById("defaultSource").value.trim();
      saveState();toast("Настройки профиля сохранены.");render();
    };

    document.getElementById("saveAccount").onclick=()=>{
      const avatarInput=document.getElementById("accountAvatar");
      const saveAccountData=avatar=>{state.account.name=document.getElementById("accountName").value.trim()||"Пользователь";state.account.avatar=avatar;saveState();toast("Аккаунт сохранён.");render();};
      const file=avatarInput.files?.[0];
      if(file){const reader=new FileReader();reader.onload=()=>saveAccountData(reader.result);reader.readAsDataURL(file);}else saveAccountData(state.account.avatar||"");
    };

    document.getElementById("addCategory").onclick=()=>{profile.categories.push(defaultCategory("Новая категория","percentage",5,3,{color:"green"}));saveState();render();};
    document.getElementById("saveCategories").onclick=()=>saveCategoriesFromUI();
    document.getElementById("saveReserve").onclick=()=>{
      profile.settings.reserve.enabled=document.getElementById("reserveEnabled").checked;
      profile.settings.reserve.percent=integer(document.getElementById("reservePercent").value);
      const limitValue=document.getElementById("reserveLimit").value;
      profile.settings.reserve.limit=limitValue===""?null:integer(limitValue);
      saveState();toast("Настройки резерва сохранены.");render();
    };
    document.getElementById("newProfile").onclick=()=>{
      const name=prompt("Название нового профиля:","Новый профиль");if(!name?.trim())return;
      const next=createProfile(name.trim());state.profiles.push(next);state.activeProfileId=next.id;saveState();render();
    };
    document.querySelectorAll("[data-open-profile]").forEach(button=>{button.onclick=()=>switchProfile(button.dataset.openProfile);});
    document.querySelectorAll("[data-delete-profile]").forEach(button=>{button.onclick=()=>deleteProfile(button.dataset.deleteProfile);});
    document.getElementById("exportData").onclick=exportData;
    document.getElementById("importData").onchange=importData;
    document.getElementById("resetData").onclick=resetData;

    enhanceAccountSettings();
    enhanceProfileSettings();
  }

  root.renderSettings=renderSettings;
  root.ARISE_SETTINGS_UI={renderSettings,enhanceAccountSettings,enhanceProfileSettings};
})(typeof globalThis!=="undefined"?globalThis:window);
