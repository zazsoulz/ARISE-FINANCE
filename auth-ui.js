(function(root){
  "use strict";

  let mode="login";

  function humanAuthError(error){
    const text=String(error&&error.message||"").toLowerCase();
    if(text.includes("invalid login credentials")) return "Неверная почта или пароль.";
    if(text.includes("email not confirmed")) return "Подтверди почту по ссылке из письма.";
    if(text.includes("user already registered")) return "Аккаунт с такой почтой уже существует.";
    if(text.includes("password")&&text.includes("characters")) return "Пароль слишком короткий.";
    if(text.includes("rate limit")) return "Слишком много попыток. Попробуй немного позже.";
    return "Не удалось выполнить вход. Проверь данные и соединение.";
  }

  function setMessage(text,type=""){
    const el=document.getElementById("authMessage");
    if(!el) return;
    el.className="notice"+(type?" "+type:"");
    el.textContent=text||"";
    el.style.display=text?"block":"none";
  }

  async function finishAuthenticatedSession(session){
    const remote=root.ARISE_SUPABASE;
    if(root.ARISE_LOCAL_ACCOUNTS) root.ARISE_LOCAL_ACCOUNTS.activate(session.user.id);
    let account=null;
    try{account=await remote.loadAccount();}catch(error){console.error("ARISE account load",error);}
    state.account.name=(account&&account.name)||session.user.user_metadata?.name||session.user.email?.split("@")[0]||"";
    state.account.email=session.user.email||"";
    state.account.avatar=(account&&account.avatar_display_url)||(account&&account.avatar_url)||session.user.user_metadata?.avatar_url||session.user.user_metadata?.picture||"";
    state.account.notifications=account?account.notifications_enabled!==false:true;
    state.account.registered=true;
    delete state.account.password;

    if(root.ARISE_SYNC_PULL){
      try{await root.ARISE_SYNC_PULL.pullAll();}
      catch(error){console.error("ARISE login pull",error);}
    }

    root.ARISE_SYNC_SILENT=true;
    try{saveState();}finally{root.ARISE_SYNC_SILENT=false;}
    render();
    if(root.ARISE_SYNC) root.ARISE_SYNC.schedule();
  }

  function bindAuth(){
    const name=document.getElementById("authNameField");
    const title=document.getElementById("authTitle");
    const submit=document.getElementById("authSubmit");
    const toggle=document.getElementById("authToggle");
    const reset=document.getElementById("authReset");

    const syncMode=()=>{
      const registering=mode==="register";
      if(name) name.style.display=registering?"block":"none";
      if(title) title.textContent=registering?"Создать аккаунт":"Войти в ARISE";
      if(submit) submit.textContent=registering?"Создать аккаунт":"Войти";
      if(toggle) toggle.textContent=registering?"Уже есть аккаунт? Войти":"Нет аккаунта? Создать";
      if(reset) reset.style.display=registering?"none":"inline-flex";
      setMessage("");
    };

    toggle.onclick=()=>{mode=mode==="login"?"register":"login";syncMode();};
    reset.onclick=async()=>{
      const email=document.getElementById("authEmail").value.trim();
      if(!email){setMessage("Укажи почту, на которую отправить ссылку.","warning");return;}
      try{await root.ARISE_SUPABASE.resetPassword(email);setMessage("Ссылка для смены пароля отправлена на почту.");}
      catch(error){console.error(error);setMessage(humanAuthError(error),"danger");}
    };

    submit.onclick=async()=>{
      const email=document.getElementById("authEmail").value.trim();
      const password=document.getElementById("authPassword").value;
      const accountName=document.getElementById("authName")?.value.trim()||"";
      if(!email||!password||(mode==="register"&&!accountName)){setMessage("Заполни обязательные поля.","warning");return;}
      submit.disabled=true;
      setMessage(mode==="register"?"Создаю аккаунт…":"Вхожу…");
      try{
        if(mode==="register"){
          const data=await root.ARISE_SUPABASE.signUp({name:accountName,email,password});
          if(!data.session){setMessage("Аккаунт создан. Подтверди почту по ссылке из письма.");return;}
          await finishAuthenticatedSession(data.session);
        }else{
          const data=await root.ARISE_SUPABASE.signIn({email,password});
          await finishAuthenticatedSession(data.session);
        }
      }catch(error){console.error("ARISE auth",error);setMessage(humanAuthError(error),"danger");}
      finally{submit.disabled=false;}
    };

    syncMode();
  }

  root.renderAuth=function(){
    const container=document.getElementById("root");
    container.innerHTML=`
      <div class="login"><section class="login-card">
        <div class="login-logo">ARISE</div>
        <div class="kicker" style="margin-top:22px">АККАУНТ</div>
        <h1 class="title" id="authTitle" style="font-size:30px">Войти в ARISE</h1>
        <div class="sub" style="margin-top:9px">Аккаунт хранит только твою личную информацию. Финансовые профили живут отдельно внутри него.</div>
        <div class="form" style="margin-top:22px">
          <div class="field full" id="authNameField" style="display:none"><label>Имя</label><input id="authName" autocomplete="name" placeholder="Имя"></div>
          <div class="field full"><label>Почта</label><input id="authEmail" type="email" autocomplete="email" placeholder="name@example.com"></div>
          <div class="field full"><label>Пароль</label><input id="authPassword" type="password" autocomplete="current-password" placeholder="Пароль"></div>
        </div>
        <div id="authMessage" class="notice" style="display:none;margin-top:14px"></div>
        <div class="actions">
          <button class="btn primary" id="authSubmit">Войти</button>
          <button class="btn" id="authToggle" type="button">Нет аккаунта? Создать</button>
          <button class="btn" id="authReset" type="button">Забыли пароль?</button>
        </div>
      </section></div>`;
    bindAuth();
  };

  root.ARISE_AUTH_UI={finishAuthenticatedSession,humanAuthError};
})(typeof globalThis!=="undefined"?globalThis:window);
