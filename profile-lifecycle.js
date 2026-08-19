(function(root){
  "use strict";

  const previousRenderSettings=root.renderSettings;
  if(typeof previousRenderSettings!=="function") return;

  function syncMeta(profile,remoteId){
    profile.ariseSync={...(profile.ariseSync||{}),remoteId,syncedAt:new Date().toISOString(),dirty:false};
  }

  async function createProfileFromSettings(){
    const name=prompt("Название нового профиля:","Новый профиль");
    if(!name||!name.trim()) return;
    const profile=createProfile(name.trim());
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
      }
    }
    render();
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

  root.ARISE_PROFILE_LIFECYCLE={createProfile:createProfileFromSettings,removeProfile};
})(typeof globalThis!=="undefined"?globalThis:window);
