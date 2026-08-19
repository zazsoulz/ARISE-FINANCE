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

  try{
    if(state.account&&Object.prototype.hasOwnProperty.call(state.account,"password")){
      delete state.account.password;
      saveState();
    }

    const remote=globalThis.ARISE_SUPABASE;
    if(remote){
      try{
        const auth=await remote.init();
        if(auth.available&&auth.session){
          let account=null;
          try{account=await remote.loadAccount();}catch(error){console.error("ARISE account hydrate",error);}
          state.account.name=(account&&account.name)||auth.session.user.user_metadata?.name||auth.session.user.email?.split("@")[0]||state.account.name||"";
          state.account.email=auth.session.user.email||state.account.email||"";
          state.account.avatar=(account&&account.avatar_url)||auth.session.user.user_metadata?.avatar_url||auth.session.user.user_metadata?.picture||state.account.avatar||"";
          state.account.notifications=account?account.notifications_enabled!==false:state.account.notifications!==false;
          state.account.registered=true;
          saveState();
        }else if(auth.available){
          // Online/SDK-ready without a real session: require real authentication.
          // Financial profile data remains local and is not deleted.
          state.account.registered=false;
          saveState();
        }
      }catch(error){
        // Offline or temporary Supabase failure: keep already authenticated local state usable.
        console.error("ARISE auth bootstrap",error);
      }
    }

    if(state.account.registered) render();
    else renderAuth();
  }finally{
    const bootStyle=document.getElementById("arise-boot-hide");
    if(bootStyle) bootStyle.remove();
    document.documentElement.style.visibility="";
  }
})();
