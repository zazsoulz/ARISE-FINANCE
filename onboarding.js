(function(root){
  "use strict";

  const baseCreateProfile=root.createProfile;
  const baseRenderSettings=root.renderSettings;
  if(typeof baseCreateProfile!=="function")return;

  function exampleCategory(name,type,percent,priority,options={}){
    if(typeof root.defaultCategory==="function")return root.defaultCategory(name,type,percent,priority,options);
    return {
      id:uid(),name,type,percent,priority,
      fixedAmount:options.fixedAmount||0,
      limit:options.limit??null,
      enabled:true,
      color:options.color||"green"
    };
  }

  function applyTemplate(profile,template="starter"){
    profile.settings=profile.settings||{};
    profile.settings.reserve={
      enabled:false,percent:0,limit:null,priority:3,
      targetBalance:null,monthlyEssentialSpend:null,
      ...(profile.settings.reserve||{})
    };
    profile.settings.onboarding={version:1,template,completed:template!=="starter"};
    profile.goals=[];

    if(template==="blank"){
      profile.categories=[];
      return profile;
    }

    profile.categories=[
      exampleCategory("Обязательные расходы","fixed",0,5,{color:"green",fixedAmount:0}),
      exampleCategory("Семья","percentage",15,4,{color:"blue"}),
      exampleCategory("Свободные деньги","percentage",20,2,{color:"purple"})
    ];
    return profile;
  }

  root.createProfile=function(name){return applyTemplate(baseCreateProfile(name),"starter");};

  async function persist(profile){
    state.profiles.push(profile);
    state.activeProfileId=profile.id;
    profile.ariseSync={...(profile.ariseSync||{}),dirty:true,changedAt:new Date().toISOString()};
    saveState();
    const remote=root.ARISE_SUPABASE;
    if(remote&&remote.currentSession&&remote.currentSession()){
      try{
        const row=await remote.createFinanceProfile({name:profile.name,baseCurrency:profile.settings.currency||"RUB",settings:profile.settings});
        profile.ariseSync={remoteId:row.id,syncedAt:new Date().toISOString(),dirty:false};
        root.ARISE_SYNC_SILENT=true;try{saveState();}finally{root.ARISE_SYNC_SILENT=false;}
      }catch(error){
        console.error("ARISE onboarding profile sync",error);
        toast("Профиль создан на устройстве. Сервер синхронизируется позже.");
      }
    }
    render();
  }

  function showNewProfileOnboarding(){
    openModal(`
      <div class="kicker">НОВЫЙ ФИНАНСОВЫЙ ПРОФИЛЬ</div>
      <h2 class="title">С чего начать</h2>
      <div class="sub" style="margin-top:8px">ARISE не навязывает структуру. Можно взять три обычные примерные категории и сразу изменить их — или начать с полностью пустого профиля. Резерв всегда отдельный, а реальные цели создаёшь только ты.</div>
      <div class="form" style="margin-top:18px">
        <div class="field full"><label>Название</label><input id="onboardingProfileName" value="Новый профиль" maxlength="60" autocomplete="off"></div>
        <div class="field full"><label>Базовая валюта</label><select id="onboardingProfileCurrency"><option value="RUB">₽ RUB</option><option value="EUR">€ EUR</option><option value="USD">$ USD</option></select></div>
      </div>
      <div style="display:grid;gap:10px;margin-top:16px">
        <label class="card soft" style="display:flex;gap:12px;align-items:flex-start;padding:15px;cursor:pointer">
          <input type="radio" name="onboardingTemplate" value="starter" checked style="width:auto;margin-top:3px">
          <span><strong>Стартовый шаблон</strong><span class="sub" style="display:block;margin-top:5px">Обязательные расходы · Семья · Свободные деньги. Это обычные категории: можно удалить, переименовать, сменить FIX/% и приоритет.</span></span>
        </label>
        <label class="card soft" style="display:flex;gap:12px;align-items:flex-start;padding:15px;cursor:pointer">
          <input type="radio" name="onboardingTemplate" value="blank" style="width:auto;margin-top:3px">
          <span><strong>Пустой профиль</strong><span class="sub" style="display:block;margin-top:5px">Без категорий и целей. Ты строишь систему полностью с нуля.</span></span>
        </label>
      </div>
      <div class="notice" style="margin-top:14px"><strong>Как работают правила</strong><div class="tiny muted" style="margin-top:6px">FIX добирается до указанной суммы за месяц. Процент без лимита применяется к каждому поступлению в этом месяце. Месячный лимит останавливает дальнейшее автоматическое распределение после достижения лимита.</div></div>
      <div id="onboardingProfileStatus" class="tiny muted" style="margin-top:10px"></div>
      <div class="actions"><button class="btn primary" id="onboardingProfileSave">Создать профиль</button><button class="btn" id="onboardingProfileCancel">Отмена</button></div>
    `);
    document.getElementById("onboardingProfileCancel").onclick=closeModal;
    document.getElementById("onboardingProfileSave").onclick=async()=>{
      const button=document.getElementById("onboardingProfileSave");
      const status=document.getElementById("onboardingProfileStatus");
      const name=document.getElementById("onboardingProfileName").value.trim();
      const currency=document.getElementById("onboardingProfileCurrency").value;
      const template=document.querySelector('input[name="onboardingTemplate"]:checked')?.value||"starter";
      if(!name){status.textContent="Укажи название профиля.";status.className="tiny negative";return;}
      button.disabled=true;status.textContent="Создаю профиль…";
      const profile=applyTemplate(baseCreateProfile(name),template);
      profile.settings.currency=currency;
      await persist(profile);
      closeModal();
      toast(template==="blank"?"Пустой профиль создан.":"Профиль создан со стартовыми примерами.");
    };
  }

  function decorateFirstRun(){
    const profile=activeProfile&&activeProfile();
    if(!profile||!profile.settings||!profile.settings.onboarding||profile.settings.onboarding.completed)return;
    const page=document.getElementById("page");
    if(!page||page.querySelector("#ariseFirstRunGuide"))return;
    const guide=document.createElement("section");
    guide.id="ariseFirstRunGuide";
    guide.className="card soft";
    guide.style.marginBottom="15px";
    guide.innerHTML=`<div class="kicker">ПЕРВЫЙ ЗАПУСК</div><h2 class="title">Это только примеры, не твои правила</h2><div class="sub" style="margin-top:8px">«Обязательные расходы», «Семья» и «Свободные деньги» можно свободно менять или удалить. Сначала настрой категории под себя, затем резерв и только после этого внеси первый доход — ARISE покажет предложение до сохранения.</div><div class="actions"><button class="btn primary" id="onboardingConfigure">Настроить категории</button><button class="btn" id="onboardingDone">Понятно</button></div>`;
    page.prepend(guide);
    document.getElementById("onboardingConfigure").onclick=()=>{activePage="settings";render();};
    document.getElementById("onboardingDone").onclick=()=>{profile.settings.onboarding.completed=true;saveState();guide.remove();};
  }

  if(typeof baseRenderSettings==="function"){
    root.renderSettings=function(){
      const result=baseRenderSettings();
      const button=document.getElementById("newProfile");
      if(button)button.onclick=showNewProfileOnboarding;
      return result;
    };
  }

  const baseRender=root.render;
  if(typeof baseRender==="function"){
    root.render=function(){const result=baseRender();decorateFirstRun();return result;};
  }

  root.ARISE_ONBOARDING={applyTemplate,showNewProfileOnboarding,decorateFirstRun};
})(typeof globalThis!=="undefined"?globalThis:window);
