(function(root){
  "use strict";

  const previousRenderSettings=root.renderSettings;
  if(typeof previousRenderSettings!=="function") return;

  function syncMeta(profile,remoteId){
    profile.ariseSync={...(profile.ariseSync||{}),remoteId,syncedAt:new Date().toISOString(),dirty:false};
  }

  async function persistNewProfile(profile){
    state.profiles.push(profile);
    state.activeProfileId=profile.id;
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
    if(profile.ariseSync) profile.ariseSync.dirty=true;
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
    }
    return true;
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

  root.renderSettings=function(){
    previousRenderSettings();
    const createButton=document.getElementById("newProfile");
    if(createButton) createButton.onclick=createProfileFromSettings;
    document.querySelectorAll("[data-delete-profile]").forEach(button=>{
      button.onclick=()=>removeProfile(button.dataset.deleteProfile);
    });
  };

  root.ARISE_PROFILE_LIFECYCLE={createProfile:createProfileFromSettings,renameProfile,removeProfile};
})(typeof globalThis!=="undefined"?globalThis:window);
