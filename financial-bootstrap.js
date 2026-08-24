(async function(){
  "use strict";

  const v3=globalThis.ARISE_V3;
  if(v3&&typeof v3.groupMonth==="function"&&!v3.__publicGroupWrapped){
    const internalGroupMonth=v3.groupMonth;
    v3.groupMonth=function(profile,month){
      const data=internalGroupMonth(profile,month);
      const {uncontrolled,...publicData}=data;
      return publicData;
    };
    v3.__publicGroupWrapped=true;
  }

  function normalizeReserveTargetCompatibility(){
    const reserveAnalytics=globalThis.ARISE_RESERVE_ANALYTICS;
    if(!reserveAnalytics||typeof reserveAnalytics.normalizeTargetSettings!=="function")return false;
    let changed=false;
    for(const profile of state.profiles||[]){
      profile.settings=profile.settings||{};
      const normalized=reserveAnalytics.normalizeTargetSettings(profile.settings.reserve||{});
      if(normalized.changed){
        profile.settings.reserve=normalized.settings;
        changed=true;
      }
    }
    return changed;
  }

  try{
    const requiredCore=["planIncome","monthStats","availableFree","reserveBalance","goalBalance","validatePlan"];
    const integrity=globalThis.ARISE_RUNTIME_INTEGRITY&&globalThis.ARISE_RUNTIME_INTEGRITY.verify
      ?globalThis.ARISE_RUNTIME_INTEGRITY.verify()
      :(()=>{
          const core=globalThis.ARISE_FINANCE_CORE;
          const missing=requiredCore.filter(name=>!core||typeof core[name]!=="function");
          return {ok:missing.length===0,missing,engine:"ARISE_FINANCE_CORE",fallback:true};
        })();
    if(!integrity.ok){
      console.error("ARISE canonical runtime integrity failed",integrity);
      const target=document.getElementById("root")||document.body;
      if(target)target.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#080b0f;color:#f0f2f3;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"><div style="max-width:520px"><strong>ARISE не удалось безопасно запустить финансовый движок.</strong><div style="margin-top:8px;color:#858e98;line-height:1.5">Данные не изменены. Обнови приложение и попробуй снова.</div></div></div>';
      return;
    }

    if(state.account&&Object.prototype.hasOwnProperty.call(state.account,"password")){
      delete state.account.password;
      saveState();
    }

    const remote=globalThis.ARISE_SUPABASE;
    if(remote){
      try{
        const auth=await remote.init();
        if(auth.available&&auth.session){
          const localAccounts=globalThis.ARISE_LOCAL_ACCOUNTS;
          if(localAccounts){
            if(localAccounts.restoreFromIndexedDb) await localAccounts.restoreFromIndexedDb(auth.session.user.id);
            localAccounts.activate(auth.session.user.id);
          }

          let account=null;
          try{account=await remote.loadAccount();}catch(error){console.error("ARISE account hydrate",error);}
          state.account.name=(account&&account.name)||auth.session.user.user_metadata?.name||auth.session.user.email?.split("@")[0]||state.account.name||"";
          state.account.email=auth.session.user.email||state.account.email||"";
          state.account.avatar=(account&&account.avatar_display_url)||(account&&account.avatar_url)||auth.session.user.user_metadata?.avatar_url||auth.session.user.user_metadata?.picture||state.account.avatar||"";
          state.account.notifications=account?account.notifications_enabled!==false:state.account.notifications!==false;
          state.account.registered=true;
          delete state.account.password;

          if(globalThis.ARISE_SYNC_PULL){
            try{await globalThis.ARISE_SYNC_PULL.pullAll();}
            catch(error){console.error("ARISE server pull",error);}
          }

          globalThis.ARISE_SYNC_SILENT=true;
          try{saveState();}finally{globalThis.ARISE_SYNC_SILENT=false;}
          if(globalThis.ARISE_SYNC) globalThis.ARISE_SYNC.schedule();
          if(globalThis.ARISE_ENTITY_OUTBOX) globalThis.ARISE_ENTITY_OUTBOX.schedule();
        }else if(auth.available){
          state.account.registered=false;
          saveState();
        }
      }catch(error){
        console.error("ARISE auth bootstrap",error);
      }
    }

    if(normalizeReserveTargetCompatibility()){
      globalThis.ARISE_SYNC_SILENT=true;
      try{saveState();}finally{globalThis.ARISE_SYNC_SILENT=false;}
    }

    if(state.account.registered) render();
    else renderAuth();
  }finally{
    const bootStyle=document.getElementById("arise-boot-hide");
    if(bootStyle) bootStyle.remove();
    document.documentElement.style.visibility="";
  }
})();