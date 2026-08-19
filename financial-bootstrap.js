(function(){
  "use strict";

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
