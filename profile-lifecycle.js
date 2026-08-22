(function(root){
  "use strict";

  const previousRenderSettings=root.renderSettings;
  if(typeof previousRenderSettings!=="function") return;

  function syncMeta(profile,remoteId){
    profile.ariseSync={...(profile.ariseSync||{}),remoteId,syncedAt:new Date().toISOString(),dirty:false};
  }
  function markProfileDirty(profile){
    profile.ariseSync={...(profile.ariseSync||{}),dirty:true,changedAt:new Date().toISOString()};
  }
  function remoteId(profile){return profile&&profile.ariseSync&&profile.ariseSync.remoteId||null;}
  function hasFinancialHistory(profile){
    return !!((profile.transactions||[]).length||(profile.goals||[]).some(goal=>Number(goal.current||goal.ledgerStart||0)>0));
  }
  function canChangeBaseCurrency(profile,nextCurrency){
    const current=profile&&profile.settings&&profile.settings.currency||"RUB";
    return !nextCurrency||nextCurrency===current||!hasFinancialHistory(profile);
  }
  function active(){
    try{return typeof activeProfile==="function"?activeProfile():null;}catch(_){return null;}
  }
  function lockCurrencyControl(profile){
    const select=typeof document!=="undefined"&&document.getElementById("settingsCurrency");
    if(!select||!profile)return;
    const locked=hasFinancialHistory(profile);
    select.disabled=locked;
    select.value=profile.settings&&profile.settings.currency||"RUB";
    select.dataset.currencyLocked=locked?"true":"false";
    const field=select.closest&&select.closest(".field");
    if(field){
      const old=field.querySelector("[data-settings-currency-note]");
      if(old)old.remove();
      const note=document.createElement("div");
      note.dataset.settingsCurrencyNote="true";
      note.className=`tiny ${locked?"warning":"muted"}`;
      note.style.marginTop="7px";
      note.textContent=locked
        ?"Базовая валюта зафиксирована после появления финансовой истории. Исходная валюта операций хранится отдельно."
        :"Базовую валюту можно менять, пока в профиле нет финансовой истории.";
      field.appendChild(note);
    }
  }
  function protectLegacySave(profile){
    const button=typeof document!=="undefined"&&document.getElementById("saveProfileSettings");
    const select=typeof document!=="undefined"&&document.getElementById("settingsCurrency");
    if(!button||!select||!profile||button.__ariseCurrencyGuard)return;
    const original=button.onclick;
    button.onclick=event=>{
      const current=profile.settings&&profile.settings.currency||"RUB";
      const requested=select.value;
      if(!canChangeBaseCurrency(profile,requested)){
        select.value=current;
        lockCurrencyControl(profile);
        if(typeof toast==="function")toast("Базовую валюту нельзя менять после появления финансовой истории.");
      }
      return typeof original==="function"?original.call(button,event):undefined;
    };
    button.__ariseCurrencyGuard=true;
  }
  function currentSession(){
    const remote=root.ARISE_SUPABASE;
    return remote&&remote.currentSession&&remote.currentSession();
  }

  async function persistNewProfile(profile){
    state.profiles.push(profile);state.activeProfileId=profile.id;markProfileDirty(profile);saveState();
    const remote=root.ARISE_SUPABASE;
    if(remote&&remote.currentSession&&remote.currentSession()){
      try{
        const row=await remote.createFinanceProfile({name:profile.name,baseCurrency:profile.settings.currency||"RUB",settings:profile.settings});
        syncMeta(profile,row.id);root.ARISE_SYNC_SILENT=true;try{saveState();}finally{root.ARISE_SYNC_SILENT=false;}
      }catch(error){console.error("ARISE create finance profile",error);toast("Профиль создан на устройстве. Сервер синхронизируется позже.");}
    }
    render();
  }

  function createProfileFromSettings(){
    openModal(`
      <div class="kicker">ФИНАНСОВЫЙ ПРОФИЛЬ</div><h2 class="title">Новый профиль</h2>
      <div class="sub" style="margin-top:8px">Профили полностью независимы: у каждого свои категории, цели, операции и статистика.</div>
      <div class="form" style="margin-top:18px">
        <div class="field full"><label>Название</label><input id="newFinanceProfileName" value="Новый профиль" maxlength="60" autocomplete="off"></div>
        <div class="field full"><label>Базовая валюта</label><select id="newFinanceProfileCurrency"><option value="RUB">₽ RUB</option><option value="EUR">€ EUR</option><option value="USD">$ USD</option></select></div>
      </div>
      <div id="newFinanceProfileStatus" class="tiny muted" style="margin-top:10px"></div>
      <div class="actions"><button class="btn primary" id="newFinanceProfileSave">Создать</button><button class="btn" id="newFinanceProfileCancel">Отмена</button></div>`);
    document.getElementById("newFinanceProfileCancel").onclick=closeModal;
    document.getElementById("newFinanceProfileSave").onclick=async()=>{
      const button=document.getElementById("newFinanceProfileSave"),status=document.getElementById("newFinanceProfileStatus");
      const name=document.getElementById("newFinanceProfileName").value.trim(),currency=document.getElementById("newFinanceProfileCurrency").value;
      if(!name){status.textContent="Укажи название профиля.";status.className="tiny negative";return;}
      button.disabled=true;status.textContent="Создаю профиль…";const profile=createProfile(name);profile.settings.currency=currency;await persistNewProfile(profile);closeModal();
    };
  }

  async function renameProfile(profileId,name,currency){
    const profile=state.profiles.find(p=>p.id===profileId);if(!profile)return false;
    if(!canChangeBaseCurrency(profile,currency)) return {ok:false,reason:"currency_locked"};
    profile.name=String(name||"").trim()||profile.name;if(currency)profile.settings.currency=currency;markProfileDirty(profile);saveState();
    const id=remoteId(profile),remote=root.ARISE_SUPABASE;
    if(id&&remote&&remote.currentSession&&remote.currentSession()){
      try{await remote.updateFinanceProfile(id,{name:profile.name,baseCurrency:profile.settings.currency,settings:profile.settings});syncMeta(profile,id);root.ARISE_SYNC_SILENT=true;try{saveState();}finally{root.ARISE_SYNC_SILENT=false;}}
      catch(error){console.error("ARISE update finance profile",error);return {ok:false,reason:"sync_failed"};}
    }else if(root.ARISE_SYNC&&root.ARISE_SYNC.schedule)root.ARISE_SYNC.schedule();
    return {ok:true};
  }

  function editProfile(profileId){
    const profile=state.profiles.find(p=>p.id===profileId);if(!profile)return;
    const currency=profile.settings&&profile.settings.currency||"RUB",locked=hasFinancialHistory(profile);
    openModal(`
      <div class="kicker">ФИНАНСОВЫЙ ПРОФИЛЬ</div><h2 class="title">Настройки профиля</h2>
      <div class="sub" style="margin-top:8px">Изменения относятся только к этому финансовому профилю и не затрагивают аккаунт или другие профили.</div>
      <div class="form" style="margin-top:18px">
        <div class="field full"><label>Название</label><input id="editFinanceProfileName" value="${escapeHTML(profile.name||"")}" maxlength="60" autocomplete="off"></div>
        <div class="field full"><label>Базовая валюта</label><select id="editFinanceProfileCurrency" ${locked?"disabled":""}>
          <option value="RUB" ${currency==="RUB"?"selected":""}>₽ RUB</option><option value="EUR" ${currency==="EUR"?"selected":""}>€ EUR</option><option value="USD" ${currency==="USD"?"selected":""}>$ USD</option>
        </select></div>
      </div>
      <div class="notice ${locked?"warning":""}" style="margin-top:14px">${locked?"Базовая валюта зафиксирована, потому что в профиле уже есть финансовая история. Это защищает ledger от неверного пересчёта. Исходная валюта каждой операции всё равно хранится отдельно.":"Базовую валюту можно менять, пока в профиле нет финансовой истории."}</div>
      <div id="editFinanceProfileStatus" class="tiny muted" style="margin-top:10px"></div>
      <div class="actions"><button class="btn primary" id="editFinanceProfileSave">Сохранить</button><button class="btn" id="editFinanceProfileCancel">Отмена</button></div>`);
    document.getElementById("editFinanceProfileCancel").onclick=closeModal;
    document.getElementById("editFinanceProfileSave").onclick=async()=>{
      const button=document.getElementById("editFinanceProfileSave"),status=document.getElementById("editFinanceProfileStatus");
      const name=document.getElementById("editFinanceProfileName").value.trim(),nextCurrency=document.getElementById("editFinanceProfileCurrency").value;
      if(!name){status.textContent="Укажи название профиля.";status.className="tiny negative";return;}
      button.disabled=true;status.textContent="Сохраняю…";const result=await renameProfile(profileId,name,nextCurrency);
      if(result&&result.reason==="currency_locked"){button.disabled=false;status.textContent="Базовую валюту нельзя менять после появления финансовой истории.";status.className="tiny negative";return;}
      closeModal();render();toast(result&&result.ok?"Профиль обновлён.":"Изменения сохранены на устройстве и будут синхронизированы позже.");
    };
  }

  async function removeProfile(profileId){
    if(state.profiles.length<=1){toast("Нельзя удалить единственный финансовый профиль.");return;}
    const profile=state.profiles.find(p=>p.id===profileId);if(!profile)return;
    const id=remoteId(profile),remote=root.ARISE_SUPABASE;

    if(hasFinancialHistory(profile)&&!id){
      toast("Сначала синхронизируй профиль. Профиль с финансовой историей нельзя удалить без серверной копии для восстановления.");
      return;
    }
    if(id&&(!remote||typeof remote.archiveFinanceProfile!=="function"||!currentSession())){
      toast("Для безопасного удаления нужен вход в аккаунт и связь с сервером. Профиль останется на устройстве.");
      return;
    }

    const recoverable=!!id;
    const message=recoverable
      ?`Архивировать финансовый профиль «${profile.name}»? Он исчезнет с этого устройства, но его можно будет восстановить из архива профилей.`
      :`Удалить пустой несинхронизированный профиль «${profile.name}»? Серверной копии у него нет.`;
    if(!confirm(message))return;

    if(recoverable){
      try{await remote.archiveFinanceProfile(id);}
      catch(error){console.error("ARISE archive finance profile",error);toast("Не удалось безопасно архивировать профиль. Локальные данные не удалены.");return;}
    }

    state.profiles=state.profiles.filter(p=>p.id!==profileId);
    if(state.activeProfileId===profileId)state.activeProfileId=state.profiles[0].id;
    saveState();render();
    toast(recoverable?"Профиль перемещён в архив. Его можно восстановить в настройках.":"Пустой профиль удалён.");
  }

  async function restoreArchivedProfile(profileRemoteId){
    const remote=root.ARISE_SUPABASE;
    if(!remote||typeof remote.restoreFinanceProfile!=="function"||!currentSession()){
      toast("Для восстановления профиля нужен вход в аккаунт и связь с сервером.");return {ok:false,reason:"unavailable"};
    }
    try{
      const row=await remote.restoreFinanceProfile(profileRemoteId);
      const pull=root.ARISE_SYNC_PULL;
      if(pull&&typeof pull.pullAll==="function")await pull.pullAll();
      const local=(state.profiles||[]).find(profile=>remoteId(profile)===row.id);
      if(local){state.activeProfileId=local.id;saveState();}
      closeModal();render();toast("Профиль восстановлен вместе с серверной финансовой историей.");
      return {ok:true,row,local:local||null};
    }catch(error){
      console.error("ARISE restore finance profile",error);toast("Не удалось восстановить профиль. Серверные данные не изменены локально.");return {ok:false,reason:"restore_failed"};
    }
  }

  async function showArchivedProfiles(){
    const remote=root.ARISE_SUPABASE;
    if(!remote||typeof remote.listArchivedFinanceProfiles!=="function"||!currentSession()){
      toast("Архив профилей доступен после входа в аккаунт.");return;
    }
    openModal(`<div class="kicker">ФИНАНСОВЫЕ ПРОФИЛИ</div><h2 class="title">Архив профилей</h2><div id="archivedProfilesBody" class="sub" style="margin-top:14px">Загружаю архив…</div><div class="actions"><button class="btn" id="archivedProfilesClose">Закрыть</button></div>`);
    document.getElementById("archivedProfilesClose").onclick=closeModal;
    const body=document.getElementById("archivedProfilesBody");
    try{
      const rows=await remote.listArchivedFinanceProfiles();
      if(!rows.length){body.innerHTML='<div class="empty">В архиве нет финансовых профилей.</div>';return;}
      body.innerHTML=rows.map(row=>`
        <div class="row">
          <div class="row-left"><strong>${escapeHTML(row.name||"Профиль")}</strong><div class="tiny muted">${escapeHTML(row.base_currency||"RUB")} · архивирован ${row.archived_at?formatDate(String(row.archived_at).slice(0,10)):"ранее"}</div></div>
          <div class="row-right"><button class="btn small-btn" data-restore-profile="${escapeHTML(row.id)}">Восстановить</button></div>
        </div>`).join("");
      body.querySelectorAll("[data-restore-profile]").forEach(button=>{button.onclick=async()=>{button.disabled=true;await restoreArchivedProfile(button.dataset.restoreProfile);};});
    }catch(error){console.error("ARISE archived finance profiles",error);body.innerHTML='<div class="notice danger">Не удалось загрузить архив профилей. Попробуй ещё раз при стабильном соединении.</div>';}
  }

  function attachEditButtons(){
    for(const profile of state.profiles||[]){
      if(document.querySelector(`[data-edit-profile="${profile.id}"]`))continue;
      let row=document.querySelector(`[data-delete-profile="${profile.id}"]`)?.closest(".row");
      if(!row)row=[...document.querySelectorAll(".row")].find(candidate=>{const text=(candidate.textContent||"").trim();return text.includes(profile.name)&&(text.includes("Текущий профиль")||text.includes("операц"));});
      if(!row)continue;const actions=row.querySelector(".row-right")||row,button=document.createElement("button");button.type="button";button.className="btn small-btn";button.dataset.editProfile=profile.id;button.textContent="Изменить";button.style.marginRight="6px";button.onclick=()=>editProfile(profile.id);actions.prepend(button);
    }
  }

  function attachArchiveButton(){
    if(document.getElementById("archivedProfiles")||!root.ARISE_SUPABASE)return;
    const createButton=document.getElementById("newProfile");
    if(!createButton)return;
    const button=document.createElement("button");button.type="button";button.className="btn";button.id="archivedProfiles";button.textContent="Архив профилей";button.onclick=showArchivedProfiles;
    createButton.insertAdjacentElement("afterend",button);
  }

  root.renderSettings=function(){
    previousRenderSettings();
    const profile=active();
    const createButton=document.getElementById("newProfile");if(createButton)createButton.onclick=createProfileFromSettings;
    document.querySelectorAll("[data-delete-profile]").forEach(button=>{button.onclick=()=>removeProfile(button.dataset.deleteProfile);});
    attachEditButtons();attachArchiveButton();lockCurrencyControl(profile);protectLegacySave(profile);
  };
  root.ARISE_PROFILE_LIFECYCLE={createProfile:createProfileFromSettings,editProfile,renameProfile,removeProfile,restoreArchivedProfile,showArchivedProfiles,hasFinancialHistory,canChangeBaseCurrency,lockCurrencyControl,protectLegacySave};
  root.ARISE_SETTINGS_CURRENCY_GUARD={lockCurrencyControl,protectLegacySave};
})(typeof globalThis!=="undefined"?globalThis:window);
