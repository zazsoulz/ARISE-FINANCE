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

  async function persistNewProfile(profile){
    state.profiles.push(profile);
    state.activeProfileId=profile.id;
    markProfileDirty(profile);
    saveState();

    const remote=root.ARISE_SUPABASE;
    if(remote&&remote.currentSession&&remote.currentSession()){
      try{
        const row=await remote.createFinanceProfile({name:profile.name,baseCurrency:profile.settings.currency||"RUB",settings:profile.settings});
        syncMeta(profile,row.id);
        root.ARISE_SYNC_SILENT=true;
        try{saveState();}finally{root.ARISE_SYNC_SILENT=false;}
      }catch(error){
        console.error("ARISE create finance profile",error);
        toast("Профиль создан на устройстве. Сервер синхронизируется позже.");
      }
    }
    render();
  }

  function createProfileFromSettings(){
    openModal(`
      <div class="kicker">ФИНАНСОВЫЙ ПРОФИЛЬ</div>
      <h2 class="title">Новый профиль</h2>
      <div class="sub" style="margin-top:8px">Профили полностью независимы: у каждого свои категории, цели, операции и статистика.</div>
      <div class="form" style="margin-top:18px">
        <div class="field full"><label>Название</label><input id="newFinanceProfileName" value="Новый профиль" maxlength="60" autocomplete="off"></div>
        <div class="field full"><label>Базовая валюта</label><select id="newFinanceProfileCurrency"><option value="RUB">₽ RUB</option><option value="EUR">€ EUR</option><option value="USD">$ USD</option></select></div>
      </div>
      <div id="newFinanceProfileStatus" class="tiny muted" style="margin-top:10px"></div>
      <div class="actions"><button class="btn primary" id="newFinanceProfileSave">Создать</button><button class="btn" id="newFinanceProfileCancel">Отмена</button></div>
    `);

    document.getElementById("newFinanceProfileCancel").onclick=closeModal;
    document.getElementById("newFinanceProfileSave").onclick=async()=>{
      const button=document.getElementById("newFinanceProfileSave");
      const status=document.getElementById("newFinanceProfileStatus");
      const name=document.getElementById("newFinanceProfileName").value.trim();
      const currency=document.getElementById("newFinanceProfileCurrency").value;
      if(!name){status.textContent="Укажи название профиля.";status.className="tiny negative";return;}
      button.disabled=true;
      status.textContent="Создаю профиль…";
      const profile=createProfile(name);
      profile.settings.currency=currency;
      await persistNewProfile(profile);
      closeModal();
    };
  }

  async function renameProfile(profileId,name,currency){
    const profile=state.profiles.find(p=>p.id===profileId);
    if(!profile) return false;

    profile.name=String(name||"").trim()||profile.name;
    if(currency) profile.settings.currency=currency;
    markProfileDirty(profile);
    saveState();

    const remoteId=profile.ariseSync&&profile.ariseSync.remoteId;
    const remote=root.ARISE_SUPABASE;
    if(remoteId&&remote&&remote.currentSession&&remote.currentSession()){
      try{
        await remote.updateFinanceProfile(remoteId,{name:profile.name,baseCurrency:profile.settings.currency,settings:profile.settings});
        syncMeta(profile,remoteId);
        root.ARISE_SYNC_SILENT=true;
        try{saveState();}finally{root.ARISE_SYNC_SILENT=false;}
      }catch(error){
        console.error("ARISE update finance profile",error);
        return false;
      }
    }else if(root.ARISE_SYNC&&root.ARISE_SYNC.schedule){
      root.ARISE_SYNC.schedule();
    }
    return true;
  }

  function editProfile(profileId){
    const profile=state.profiles.find(p=>p.id===profileId);
    if(!profile) return;
    const currency=profile.settings&&profile.settings.currency||"RUB";

    openModal(`
      <div class="kicker">ФИНАНСОВЫЙ ПРОФИЛЬ</div>
      <h2 class="title">Настройки профиля</h2>
      <div class="sub" style="margin-top:8px">Изменения относятся только к этому финансовому профилю и не затрагивают аккаунт или другие профили.</div>
      <div class="form" style="margin-top:18px">
        <div class="field full"><label>Название</label><input id="editFinanceProfileName" value="${escapeHTML(profile.name||"")}" maxlength="60" autocomplete="off"></div>
        <div class="field full"><label>Базовая валюта</label><select id="editFinanceProfileCurrency">
          <option value="RUB" ${currency==="RUB"?"selected":""}>₽ RUB</option>
          <option value="EUR" ${currency==="EUR"?"selected":""}>€ EUR</option>
          <option value="USD" ${currency==="USD"?"selected":""}>$ USD</option>
        </select></div>
      </div>
      <div class="notice warning" style="margin-top:14px">Смена базовой валюты не переписывает валюту уже сохранённых операций. Их исходная валюта остаётся в истории.</div>
      <div id="editFinanceProfileStatus" class="tiny muted" style="margin-top:10px"></div>
      <div class="actions"><button class="btn primary" id="editFinanceProfileSave">Сохранить</button><button class="btn" id="editFinanceProfileCancel">Отмена</button></div>
    `);

    document.getElementById("editFinanceProfileCancel").onclick=closeModal;
    document.getElementById("editFinanceProfileSave").onclick=async()=>{
      const button=document.getElementById("editFinanceProfileSave");
      const status=document.getElementById("editFinanceProfileStatus");
      const name=document.getElementById("editFinanceProfileName").value.trim();
      const nextCurrency=document.getElementById("editFinanceProfileCurrency").value;
      if(!name){status.textContent="Укажи название профиля.";status.className="tiny negative";return;}
      button.disabled=true;
      status.textContent="Сохраняю…";
      const synced=await renameProfile(profileId,name,nextCurrency);
      closeModal();
      render();
      toast(synced?"Профиль обновлён.":"Изменения сохранены на устройстве и будут синхронизированы позже.");
    };
  }

  async function removeProfile(profileId){
    if(state.profiles.length<=1){toast("Нельзя удалить единственный финансовый профиль.");return;}
    const profile=state.profiles.find(p=>p.id===profileId);
    if(!profile) return;
    if(!confirm(`Удалить финансовый профиль «${profile.name}»? Его локальные данные будут удалены с этого устройства.`)) return;

    const remoteId=profile.ariseSync&&profile.ariseSync.remoteId;
    const remote=root.ARISE_SUPABASE;
    if(remoteId&&remote&&remote.currentSession&&remote.currentSession()){
      try{await remote.archiveFinanceProfile(remoteId);}
      catch(error){
        console.error("ARISE archive finance profile",error);
        toast("Не удалось удалить профиль с сервера. Попробуй ещё раз при стабильном соединении.");
        return;
      }
    }

    state.profiles=state.profiles.filter(p=>p.id!==profileId);
    if(state.activeProfileId===profileId) state.activeProfileId=state.profiles[0].id;
    saveState();
    render();
  }

  function attachEditButtons(){
    for(const profile of state.profiles||[]){
      if(document.querySelector(`[data-edit-profile="${profile.id}"]`)) continue;
      let row=document.querySelector(`[data-delete-profile="${profile.id}"]`)?.closest(".row");
      if(!row){
        row=[...document.querySelectorAll(".row")].find(candidate=>{
          const text=(candidate.textContent||"").trim();
          return text.includes(profile.name)&&(text.includes("Текущий профиль")||text.includes("операц"));
        });
      }
      if(!row) continue;
      const actions=row.querySelector(".row-right")||row;
      const button=document.createElement("button");
      button.type="button";
      button.className="btn small-btn";
      button.dataset.editProfile=profile.id;
      button.textContent="Изменить";
      button.style.marginRight="6px";
      button.onclick=()=>editProfile(profile.id);
      actions.prepend(button);
    }
  }

  root.renderSettings=function(){
    previousRenderSettings();
    const createButton=document.getElementById("newProfile");
    if(createButton) createButton.onclick=createProfileFromSettings;
    document.querySelectorAll("[data-delete-profile]").forEach(button=>{
      button.onclick=()=>removeProfile(button.dataset.deleteProfile);
    });
    attachEditButtons();
  };

  root.ARISE_PROFILE_LIFECYCLE={createProfile:createProfileFromSettings,editProfile,renameProfile,removeProfile};
})(typeof globalThis!=="undefined"?globalThis:window);
