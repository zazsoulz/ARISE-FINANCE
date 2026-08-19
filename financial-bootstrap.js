(function(){
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
    if(state.account.registered){
      render();
    }else{
      renderAuth();
    }
  }finally{
    const bootStyle=document.getElementById("arise-boot-hide");
    if(bootStyle) bootStyle.remove();
    document.documentElement.style.visibility="";
  }
})();
