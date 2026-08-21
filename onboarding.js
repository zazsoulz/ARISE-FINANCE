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

  const templateCatalog={
    starter:{
      title:"Примеры категорий",
      choice:"Взять примеры",
      meta:"3 категории · 0 целей · резерв выключен",
      detail:"«Обязательные расходы» — FIX без заданной суммы, «Семья» — 15%, «Повседневные расходы» — 20%. Всё можно изменить или удалить. Остаток после правил хранится отдельно как «Не распределено».",
      createLabel:"Создать с примерами"
    },
    blank:{
      title:"С нуля",
      choice:"Начать с нуля",
      meta:"0 категорий · 0 целей · резерв выключен",
      detail:"ARISE не создаст ни одного правила. Пока ты не добавишь их сам, новый доход будет оставаться в системном остатке «Не распределено».",
      createLabel:"Создать пустой профиль"
    }
  };
  const normalizeTemplate=value=>value==="blank"?"blank":"starter";
  const templatePresentation=value=>templateCatalog[normalizeTemplate(value)];

  function applyTemplate(profile,template="starter"){
    const selected=normalizeTemplate(template);
    profile.settings=profile.settings||{};
    profile.settings.reserve={
      ...(profile.settings.reserve||{}),
      enabled:false,percent:0,limit:null,priority:3,
      targetBalance:null,monthlyEssentialSpend:null
    };
    profile.settings.onboarding={version:2,template:selected,completed:false};
    profile.goals=[];

    if(selected==="blank"){
      profile.categories=[];
      return profile;
    }

    profile.categories=[
      exampleCategory("Обязательные расходы","fixed",0,5,{color:"green",fixedAmount:0}),
      exampleCategory("Семья","percentage",15,4,{color:"blue"}),
      exampleCategory("Повседневные расходы","percentage",20,2,{color:"purple"})
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

  function updateTemplatePreview(){
    const selected=normalizeTemplate(document.querySelector('input[name="onboardingTemplate"]:checked')?.value);
    const presentation=templatePresentation(selected);
    document.querySelectorAll("[data-onboarding-template-card]").forEach(card=>{
      const active=card.dataset.onboardingTemplateCard===selected;
      card.classList.toggle("is-selected",active);
    });
    const preview=document.getElementById("onboardingTemplatePreview");
    if(preview){
      preview.dataset.onboardingTemplatePreview=selected;
      const meta=preview.querySelector("[data-onboarding-preview-meta]");
      const detail=preview.querySelector("[data-onboarding-preview-detail]");
      if(meta)meta.textContent=presentation.meta;
      if(detail)detail.textContent=presentation.detail;
    }
    const button=document.getElementById("onboardingProfileSave");
    if(button)button.textContent=presentation.createLabel;
    return selected;
  }

  function showNewProfileOnboarding(){
    openModal(`
      <div class="kicker">НОВЫЙ ФИНАНСОВЫЙ ПРОФИЛЬ</div>
      <h2 class="title">С чего начать</h2>
      <div class="sub" style="margin-top:8px">Выбери только начальную структуру. Категории, цели, резерв и операции каждого финансового профиля полностью изолированы от остальных.</div>
      <div class="form" style="margin-top:18px">
        <div class="field full"><label>Название</label><input id="onboardingProfileName" value="Новый профиль" maxlength="60" autocomplete="off"></div>
        <div class="field full"><label>Базовая валюта</label><select id="onboardingProfileCurrency"><option value="RUB">₽ RUB</option><option value="EUR">€ EUR</option><option value="USD">$ USD</option></select></div>
      </div>
      <div class="onboarding-template-list" role="radiogroup" aria-label="Начальная структура профиля">
        <label class="onboarding-template-card is-selected" data-onboarding-template-card="starter">
          <input type="radio" name="onboardingTemplate" value="starter" checked>
          <span><strong>${templateCatalog.starter.title}</strong><span>${templateCatalog.starter.choice}</span></span>
        </label>
        <label class="onboarding-template-card" data-onboarding-template-card="blank">
          <input type="radio" name="onboardingTemplate" value="blank">
          <span><strong>${templateCatalog.blank.title}</strong><span>${templateCatalog.blank.choice}</span></span>
        </label>
      </div>
      <div class="onboarding-template-preview" id="onboardingTemplatePreview" data-onboarding-template-preview="starter" aria-live="polite">
        <span>БУДЕТ СОЗДАНО</span><strong data-onboarding-preview-meta></strong><p data-onboarding-preview-detail></p>
      </div>
      <div class="notice onboarding-remainder-note"><strong>«Не распределено» — не категория</strong><div class="tiny muted">Ни один вариант не создаёт системную категорию «Свободные деньги». Нераспределённый остаток существует отдельно и переносится дальше.</div></div>
      <div id="onboardingProfileStatus" class="tiny muted" style="margin-top:10px"></div>
      <div class="actions"><button class="btn primary" id="onboardingProfileSave">Создать с примерами</button><button class="btn" id="onboardingProfileCancel">Отмена</button></div>
    `);
    document.querySelectorAll('input[name="onboardingTemplate"]').forEach(input=>input.addEventListener("change",updateTemplatePreview));
    updateTemplatePreview();
    document.getElementById("onboardingProfileCancel").onclick=closeModal;
    document.getElementById("onboardingProfileSave").onclick=async()=>{
      const button=document.getElementById("onboardingProfileSave");
      const status=document.getElementById("onboardingProfileStatus");
      const name=document.getElementById("onboardingProfileName").value.trim();
      const currency=document.getElementById("onboardingProfileCurrency").value;
      const template=updateTemplatePreview();
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
    guide.className="card soft onboarding-first-run";
    const template=normalizeTemplate(profile.settings.onboarding.template);
    const blank=template==="blank";
    guide.innerHTML=`<div class="kicker">ПЕРВЫЙ ЗАПУСК</div><h2 class="title">${blank?"Профиль создан с нуля":"Примеры готовы — сделай их своими"}</h2><div class="sub" style="margin-top:8px">${blank?"Категорий, целей и правил резерва пока нет. До их создания новый доход останется в «Не распределено» — это отдельный системный остаток, а не категория.":"«Обязательные расходы», «Семья» и «Повседневные расходы» — обычные редактируемые примеры. Проверь суммы, проценты и приоритеты перед первым доходом. Остаток после правил останется в «Не распределено»."}</div><div class="actions"><button class="btn primary" id="onboardingConfigure">${blank?"Создать первое правило":"Проверить категории"}</button><button class="btn" id="onboardingDone">${blank?"Оставить как есть":"Понятно"}</button></div>`;
    page.prepend(guide);
    document.getElementById("onboardingConfigure").onclick=()=>{profile.settings.onboarding.completed=true;saveState();activePage="settings";render();};
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

  root.ARISE_ONBOARDING={applyTemplate,showNewProfileOnboarding,decorateFirstRun,templatePresentation,updateTemplatePreview};
})(typeof globalThis!=="undefined"?globalThis:window);
