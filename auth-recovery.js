(function(root){
  "use strict";

  let pending=false;
  let subscribed=false;

  function client(){
    const api=root.ARISE_SUPABASE;
    return api&&typeof api.getClient==="function"?api.getClient():null;
  }

  function passwordError(error){
    const text=String(error&&error.message||"").toLowerCase();
    if(text.includes("same password")) return "Новый пароль должен отличаться от текущего.";
    if(text.includes("password")&&(text.includes("characters")||text.includes("weak"))) return "Используй более надёжный пароль — минимум 8 символов.";
    if(text.includes("session")||text.includes("jwt")) return "Ссылка восстановления устарела. Запроси новую ссылку на входе.";
    return "Не удалось изменить пароль. Попробуй ещё раз или запроси новую ссылку.";
  }

  function show(){
    if(!pending||typeof root.openModal!=="function") return false;
    pending=false;
    root.openModal(`
      <div class="kicker">ВОССТАНОВЛЕНИЕ ДОСТУПА</div>
      <h2 class="title">Задай новый пароль</h2>
      <div class="sub" style="margin-top:8px">Ссылка подтверждена. Новый пароль применяется к аккаунту через Supabase Auth и никогда не сохраняется в локальных финансовых данных.</div>
      <div class="form" style="margin-top:18px">
        <div class="field full"><label>Новый пароль</label><input id="recoveryPassword" type="password" minlength="8" autocomplete="new-password" placeholder="Минимум 8 символов"></div>
        <div class="field full"><label>Повтори пароль</label><input id="recoveryPasswordRepeat" type="password" minlength="8" autocomplete="new-password" placeholder="Повтори новый пароль"></div>
      </div>
      <div id="recoveryStatus" class="notice" style="display:none;margin-top:14px"></div>
      <div class="actions"><button class="btn primary" id="recoverySave">Сохранить новый пароль</button><button class="btn" id="recoveryLater" type="button">Позже</button></div>
    `);

    const save=document.getElementById("recoverySave");
    const later=document.getElementById("recoveryLater");
    const status=document.getElementById("recoveryStatus");
    const setStatus=(text,type="")=>{if(!status)return;status.textContent=text||"";status.className="notice"+(type?" "+type:"");status.style.display=text?"block":"none";};
    if(later) later.onclick=()=>{if(typeof root.closeModal==="function")root.closeModal();};
    if(save) save.onclick=async()=>{
      const password=document.getElementById("recoveryPassword")?.value||"";
      const repeat=document.getElementById("recoveryPasswordRepeat")?.value||"";
      if(password.length<8){setStatus("Пароль должен содержать минимум 8 символов.","warning");return;}
      if(password!==repeat){setStatus("Пароли не совпадают.","warning");return;}
      save.disabled=true;
      setStatus("Сохраняю новый пароль…");
      try{
        const api=root.ARISE_SUPABASE;
        if(!api||typeof api.updatePassword!=="function")throw new Error("Auth unavailable");
        await api.updatePassword(password);
        setStatus("Пароль обновлён. Теперь можно пользоваться ARISE с новым паролем.");
        setTimeout(()=>{if(typeof root.closeModal==="function")root.closeModal();},700);
      }catch(error){
        console.error("ARISE password recovery",error);
        setStatus(passwordError(error),"danger");
        save.disabled=false;
      }
    };
    return true;
  }

  function showIfPending(){return show();}

  function start(){
    if(subscribed)return true;
    const c=client();
    if(!c||!c.auth||typeof c.auth.onAuthStateChange!=="function")return false;
    c.auth.onAuthStateChange((event)=>{
      if(event!=="PASSWORD_RECOVERY")return;
      pending=true;
      setTimeout(()=>show(),0);
    });
    subscribed=true;
    return true;
  }

  root.ARISE_AUTH_RECOVERY={start,showIfPending,passwordError,isPending:()=>pending};
  start();
})(typeof globalThis!=="undefined"?globalThis:window);
