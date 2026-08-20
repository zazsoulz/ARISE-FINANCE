(function(root){
  "use strict";

  const originalRenderSettings=root.renderSettings;
  if(typeof originalRenderSettings!=="function") return;

  function syncText(){
    if(typeof navigator!=="undefined"&&navigator.onLine===false) return "Офлайн · изменения сохраняются на устройстве";
    const result=root.ARISE_SYNC&&root.ARISE_SYNC.lastResult?root.ARISE_SYNC.lastResult():null;
    if(!result) return "Синхронизация ещё не выполнялась";
    if(result.status==="synced") return "Синхронизировано";
    if(result.status==="error") return "Ошибка синхронизации";
    if(result.status==="offline") return "Офлайн · изменения ждут подключения";
    return "Синхронизация…";
  }

  function accountCard(){
    const name=state.account.name||"Пользователь";
    const avatar=state.account.avatar||"";
    const letter=name.trim().slice(0,1).toUpperCase()||"П";
    return `<div class="c12" data-canonical-account-card><section class="card">
      <div class="kicker">АККАУНТ</div>
      <h2 class="title">Личные данные</h2>
      <div class="sub" style="margin-top:7px">Аккаунт отвечает только за вход и личную информацию. Деньги, цели и статистика находятся внутри выбранного финансового профиля.</div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:18px;flex-wrap:wrap">
        <div class="avatar" style="width:58px;height:58px;flex-basis:58px">${avatar?`<img src="${escapeHTML(avatar)}" alt="Фото профиля">`:escapeHTML(letter)}</div>
        <div>
          <label class="btn small-btn" for="canonicalAccountAvatar" style="display:inline-flex">Изменить фото</label>
          <input id="canonicalAccountAvatar" type="file" accept="image/jpeg,image/png,image/webp" style="display:none">
          <div class="tiny muted" style="margin-top:7px">JPG, PNG или WEBP · до 5 МБ</div>
        </div>
      </div>
      <div class="form" style="margin-top:18px">
        <div class="field"><label>Имя</label><input id="canonicalAccountName" value="${escapeHTML(name)}" autocomplete="name"></div>
        <div class="field"><label>Почта</label><input id="canonicalAccountEmail" value="${escapeHTML(state.account.email||"")}" readonly></div>
      </div>
      <label class="check" style="margin-top:15px"><input id="canonicalAccountNotifications" type="checkbox" ${state.account.notifications!==false?"checked":""}> Уведомления ARISE</label>
      <div class="notice" style="margin-top:15px"><div class="tiny muted">СИНХРОНИЗАЦИЯ</div><div id="canonicalSyncStatus" style="margin-top:6px;font-size:13px">${escapeHTML(syncText())}</div></div>
      <div id="canonicalAccountStatus" class="tiny muted" style="margin-top:12px"></div>
      <div class="actions">
        <button class="btn primary" id="canonicalAccountSave">Сохранить аккаунт</button>
        <button class="btn" id="canonicalSyncNow">Синхронизировать сейчас</button>
        <button class="btn" id="canonicalPasswordChange">Изменить пароль</button>
        <button class="btn danger" id="canonicalLogout">Выйти</button>
      </div>
    </section></div>`;
  }

  function status(text,error=false){const el=document.getElementById("canonicalAccountStatus");if(!el)return;el.textContent=text||"";el.className="tiny "+(error?"negative":"muted");}
  function syncStatus(text,error=false){const el=document.getElementById("canonicalSyncStatus");if(!el)return;el.textContent=text||"";el.className=error?"negative":"";}

  async function saveAccount(){
    const name=document.getElementById("canonicalAccountName").value.trim()||"Пользователь";
    const notifications=document.getElementById("canonicalAccountNotifications").checked;
    const remote=root.ARISE_SUPABASE;status("Сохраняю…");
    try{
      if(remote&&remote.currentSession()) await remote.updateAccount({name,notifications_enabled:notifications});
      state.account.name=name;state.account.notifications=notifications;delete state.account.password;saveState();
      status(remote&&remote.currentSession()?"Сохранено в аккаунте.":"Сохранено на устройстве. Сервер синхронизируется после подключения.");
      render();
    }catch(error){console.error("ARISE account save",error);status("Не удалось сохранить аккаунт.",true);}
  }

  async function uploadAvatar(file){
    if(!file)return;const remote=root.ARISE_SUPABASE;
    if(!remote||!remote.currentSession()){status("Для загрузки фото нужен интернет и активный вход.",true);return;}
    status("Загружаю фото…");
    try{const displayUrl=await remote.uploadAvatar(file);state.account.avatar=displayUrl;delete state.account.password;saveState();status("Фото обновлено.");render();}
    catch(error){console.error("ARISE avatar upload",error);status(error.message||"Не удалось загрузить фото.",true);}
  }

  async function syncNow(){
    if(!root.ARISE_SYNC){syncStatus("Синхронизация недоступна.",true);return;}
    const button=document.getElementById("canonicalSyncNow");button.disabled=true;syncStatus("Синхронизация…");
    try{const result=await root.ARISE_SYNC.pushAll();if(result.status==="synced")syncStatus("Синхронизировано");else if(result.status==="offline")syncStatus("Офлайн · изменения ждут подключения");else syncStatus("Синхронизация не выполнена",true);}
    catch(error){console.error("ARISE manual sync",error);syncStatus("Ошибка синхронизации",true);}
    finally{button.disabled=false;}
  }

  function showPasswordChange(){
    openModal(`<div class="kicker">БЕЗОПАСНОСТЬ</div><h2 class="title">Изменить пароль</h2><div class="field" style="margin-top:18px"><label>Новый пароль</label><input id="canonicalNewPassword" type="password" autocomplete="new-password" placeholder="Минимум 8 символов"></div><div id="canonicalPasswordStatus" class="tiny muted" style="margin-top:10px"></div><div class="actions"><button class="btn primary" id="canonicalPasswordSave">Сохранить пароль</button><button class="btn" id="canonicalPasswordCancel">Отмена</button></div>`);
    document.getElementById("canonicalPasswordCancel").onclick=closeModal;
    document.getElementById("canonicalPasswordSave").onclick=async()=>{
      const password=document.getElementById("canonicalNewPassword").value;const line=document.getElementById("canonicalPasswordStatus");
      if(password.length<8){line.textContent="Пароль должен содержать минимум 8 символов.";line.className="tiny negative";return;}
      try{await root.ARISE_SUPABASE.updatePassword(password);closeModal();toast("Пароль изменён.");}
      catch(error){console.error("ARISE password update",error);line.textContent="Не удалось изменить пароль.";line.className="tiny negative";}
    };
  }

  async function logout(){
    if(!confirm("Выйти из аккаунта ARISE на этом устройстве?"))return;
    try{if(root.ARISE_SUPABASE)await root.ARISE_SUPABASE.signOut();}catch(error){console.error("ARISE logout",error);}
    if(root.ARISE_LOCAL_ACCOUNTS)root.ARISE_LOCAL_ACCOUNTS.deactivate();else{state.account.registered=false;delete state.account.password;saveState();}
    activePage="home";renderAuth();
  }

  root.renderSettings=function(){
    originalRenderSettings();const page=document.getElementById("page");const grid=page&&page.querySelector(".grid");if(!grid)return;
    for(const kicker of grid.querySelectorAll(".kicker")){if((kicker.textContent||"").trim()==="АККАУНТ"){const owner=kicker.closest(".c12,.c8,.c7,.c6,.c5,.c4,.c3");if(owner)owner.remove();}}
    grid.insertAdjacentHTML("afterbegin",accountCard());
    document.getElementById("canonicalAccountSave").onclick=saveAccount;
    document.getElementById("canonicalAccountAvatar").onchange=event=>uploadAvatar(event.target.files&&event.target.files[0]);
    document.getElementById("canonicalSyncNow").onclick=syncNow;
    document.getElementById("canonicalPasswordChange").onclick=showPasswordChange;
    document.getElementById("canonicalLogout").onclick=logout;
  };

  if(root.addEventListener)root.addEventListener("arise:sync",event=>{const detail=event.detail||{};if(detail.status==="synced")syncStatus("Синхронизировано");else if(detail.status==="error")syncStatus("Ошибка синхронизации",true);});
})(typeof globalThis!=="undefined"?globalThis:window);
