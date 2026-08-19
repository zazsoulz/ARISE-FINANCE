(function(root){
  "use strict";

  const legacyRenderSettings=root.renderSettings;
  if(typeof legacyRenderSettings!=="function") return;

  function accountCard(){
    const account=state.account||{};
    const avatar=account.avatar
      ? `<img src="${escapeHTML(account.avatar)}" alt="">`
      : escapeHTML((account.name||"П").trim().slice(0,1).toUpperCase());
    return `<section class="card" id="canonicalAccountSettings">
      <div class="kicker">АККАУНТ</div>
      <h2 class="title">Личные данные</h2>
      <div class="sub" style="margin-top:7px">Аккаунт хранит личные данные отдельно от финансовых профилей.</div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:18px">
        <div class="avatar" id="accountAvatarPreview" style="width:52px;height:52px;flex-basis:52px">${avatar}</div>
        <label class="btn small-btn" style="cursor:pointer">Изменить фото<input id="accountAvatarFile" type="file" accept="image/jpeg,image/png,image/webp" style="display:none"></label>
      </div>
      <div class="form" style="margin-top:18px">
        <div class="field full"><label>Имя</label><input id="accountNameCanonical" value="${escapeHTML(account.name||"")}" autocomplete="name"></div>
        <div class="field full"><label>Email</label><input id="accountEmailCanonical" value="${escapeHTML(account.email||"")}" disabled></div>
      </div>
      <label style="display:flex;align-items:center;gap:10px;margin-top:16px;color:var(--text2);font-size:13px">
        <input id="accountNotificationsCanonical" type="checkbox" style="width:auto" ${account.notifications!==false?"checked":""}>
        Уведомления ARISE
      </label>
      <div id="accountSettingsMessage" class="notice" style="display:none;margin-top:14px"></div>
      <div class="actions">
        <button class="btn primary" id="saveAccountCanonical">Сохранить аккаунт</button>
        <button class="btn" id="changePasswordCanonical">Сменить пароль</button>
        <button class="btn danger" id="logoutCanonical">Выйти</button>
      </div>
    </section>`;
  }

  function message(text,type=""){
    const el=document.getElementById("accountSettingsMessage");
    if(!el) return;
    el.style.display=text?"block":"none";
    el.className="notice"+(type?" "+type:"");
    el.textContent=text||"";
  }

  async function saveAccount(){
    const button=document.getElementById("saveAccountCanonical");
    const name=document.getElementById("accountNameCanonical").value.trim()||"Пользователь";
    const notifications=document.getElementById("accountNotificationsCanonical").checked;
    button.disabled=true;
    message("Сохраняю…");
    try{
      const remote=await root.ARISE_SUPABASE.updateAccount({name,notifications_enabled:notifications});
      state.account.name=remote.name||name;
      state.account.notifications=remote.notifications_enabled!==false;
      if(remote.avatar_display_url) state.account.avatar=remote.avatar_display_url;
      delete state.account.password;
      saveState();
      message("Аккаунт сохранён.");
      render();
    }catch(error){
      console.error("ARISE account save",error);
      message(error.message||"Не удалось сохранить аккаунт.","danger");
    }finally{button.disabled=false;}
  }

  async function uploadAvatar(file){
    if(!file) return;
    message("Загружаю фото…");
    try{
      const url=await root.ARISE_SUPABASE.uploadAvatar(file);
      state.account.avatar=url||"";
      delete state.account.password;
      saveState();
      render();
    }catch(error){
      console.error("ARISE avatar upload",error);
      message(error.message||"Не удалось загрузить фото.","danger");
    }
  }

  async function changePassword(){
    const first=prompt("Новый пароль (минимум 8 символов):");
    if(first===null) return;
    if(first.length<8){message("Пароль должен содержать минимум 8 символов.","warning");return;}
    const second=prompt("Повтори новый пароль:");
    if(second!==first){message("Пароли не совпадают.","warning");return;}
    try{
      await root.ARISE_SUPABASE.updatePassword(first);
      message("Пароль изменён.");
    }catch(error){console.error("ARISE password update",error);message(error.message||"Не удалось изменить пароль.","danger");}
  }

  async function logout(){
    const button=document.getElementById("logoutCanonical");
    button.disabled=true;
    try{
      await root.ARISE_SUPABASE.signOut();
      const currentUser=root.ARISE_LOCAL_VAULT&&root.ARISE_LOCAL_VAULT.currentUserId?root.ARISE_LOCAL_VAULT.currentUserId():null;
      if(root.ARISE_LOCAL_VAULT&&root.ARISE_LOCAL_VAULT.clearActive) root.ARISE_LOCAL_VAULT.clearActive(currentUser);
      state.account.registered=false;
      state.account.email="";
      state.account.name="";
      state.account.avatar="";
      delete state.account.password;
      saveState();
      renderAuth();
    }catch(error){console.error("ARISE logout",error);message(error.message||"Не удалось выйти.","danger");button.disabled=false;}
  }

  root.renderSettings=function(){
    legacyRenderSettings();
    const page=document.getElementById("page");
    if(!page) return;
    const legacy=[...page.querySelectorAll(".card")].find(card=>/АККАУНТ/i.test(card.textContent||""));
    if(legacy) legacy.remove();
    const grid=page.querySelector(".grid")||page;
    const wrapper=document.createElement("div");
    wrapper.className=grid.classList.contains("grid")?"c12":"";
    wrapper.innerHTML=accountCard();
    grid.prepend(wrapper);

    document.getElementById("saveAccountCanonical").onclick=saveAccount;
    document.getElementById("changePasswordCanonical").onclick=changePassword;
    document.getElementById("logoutCanonical").onclick=logout;
    document.getElementById("accountAvatarFile").onchange=event=>uploadAvatar(event.target.files&&event.target.files[0]);
  };
})(typeof globalThis!=="undefined"?globalThis:window);
