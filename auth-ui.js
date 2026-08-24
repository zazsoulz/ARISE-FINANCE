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
    const localAccounts=root.ARISE_LOCAL_ACCOUNTS;
    if(localAccounts){
      if(localAccounts.restoreFromIndexedDb) await localAccounts.restoreFromIndexedDb(session.user.id);
      localAccounts.activate(session.user.id);
    }

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
    if(root.ARISE_ENTITY_OUTBOX) root.ARISE_ENTITY_OUTBOX.schedule();
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

  function authVisual(){
    return `<aside class="login-visual" aria-hidden="true"><div class="login-visual-copy"><span>ФИНАНСОВЫЙ ПОТОК</span><strong>Деньги становятся<br>понятным маршрутом.</strong><p>От поступления — к обязательному, резерву и целям.</p></div><svg class="login-flow" viewBox="0 0 560 560" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="loginFlowGradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff8e8" stop-opacity=".95"/><stop offset=".5" stop-color="#d8c08b" stop-opacity=".68"/><stop offset="1" stop-color="#96b8bb" stop-opacity=".18"/></linearGradient><radialGradient id="loginFlowPool"><stop stop-color="#d7b56e" stop-opacity=".15"/><stop offset="1" stop-color="#d7b56e" stop-opacity="0"/></radialGradient><filter id="loginFlowGlow" x="-200%" y="-100%" width="500%" height="300%"><feGaussianBlur stdDeviation="4"/></filter><filter id="loginParticleGlow" x="-500%" y="-500%" width="1000%" height="1000%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><ellipse cx="280" cy="492" rx="210" ry="55" fill="url(#loginFlowPool)"/><g class="login-flow-aura" filter="url(#loginFlowGlow)"><path d="M280 42 C245 152 320 240 267 354 C244 405 258 453 280 484"/><path d="M280 42 C317 151 244 239 296 354 C319 405 302 454 280 484"/><path d="M278 176 C215 183 171 205 123 238"/><path d="M282 252 C345 262 390 285 438 316"/></g><path id="loginFlowTrunk" class="login-flow-trunk" d="M280 42 C245 152 320 240 267 354 C244 405 258 453 280 484"/><path class="login-flow-trunk secondary" d="M280 42 C317 151 244 239 296 354 C319 405 302 454 280 484"/><path id="loginFlowLeft" class="login-flow-branch" d="M278 176 C215 183 171 205 123 238"/><path id="loginFlowRight" class="login-flow-branch cool" d="M282 252 C345 262 390 285 438 316"/><g class="login-flow-particles" filter="url(#loginParticleGlow)"><circle r="2.3"><animateMotion dur="7s" begin="-1.3s" repeatCount="indefinite"><mpath href="#loginFlowTrunk"/></animateMotion></circle><circle r="1.2"><animateMotion dur="9.2s" begin="-6.1s" repeatCount="indefinite"><mpath href="#loginFlowTrunk"/></animateMotion></circle><circle r="1.7"><animateMotion dur="5.1s" begin="-2.8s" repeatCount="indefinite"><mpath href="#loginFlowLeft"/></animateMotion></circle><circle class="cool" r="1.8"><animateMotion dur="5.4s" begin="-.9s" repeatCount="indefinite"><mpath href="#loginFlowRight"/></animateMotion></circle></g><g class="login-flow-rings"><ellipse cx="280" cy="488" rx="82" ry="18"/><ellipse cx="280" cy="490" rx="145" ry="34"/><ellipse cx="280" cy="493" rx="205" ry="50"/></g><circle class="login-flow-source" cx="280" cy="42" r="5"/><circle class="login-flow-destination" cx="123" cy="238" r="4"/><circle class="login-flow-destination cool" cx="438" cy="316" r="4"/></svg></aside>`;
  }

  root.renderAuth=function(){
    const container=document.getElementById("root");
    container.innerHTML=`
      <div class="login"><div class="login-shell">${authVisual()}<section class="login-card">
        <div class="login-logo">ARISE</div>
        <div class="kicker" style="margin-top:22px">АККАУНТ</div>
        <h1 class="title" id="authTitle" style="font-size:30px">Войти в ARISE</h1>
        <div class="sub" style="margin-top:9px">Аккаунт хранит только твою личную информацию. Финансовые профили живут отдельно внутри него.</div>
        <div class="login-assurance"><i aria-hidden="true"></i><span>Локальная копия данных</span><b aria-hidden="true"></b><span>Защищённая синхронизация</span></div>
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
      </section></div></div>`;
    bindAuth();
  };

  root.ARISE_AUTH_UI={finishAuthenticatedSession,humanAuthError,authVisual};
})(typeof globalThis!=="undefined"?globalThis:window);
