const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function load(){
  let seq=0;
  const context={
    console,
    uid:()=>`id-${++seq}`,
    defaultCategory:(name,type,percent,priority,options={})=>({
      id:`cat-${++seq}`,name,type,percent,priority,
      fixedAmount:options.fixedAmount||0,limit:options.limit??null,
      enabled:true,color:options.color||'green'
    }),
    createProfile:name=>({
      id:`profile-${++seq}`,name:name||'Мой профиль',
      settings:{currency:'RUB',reserve:{enabled:false,percent:0,limit:null}},
      categories:[{id:'legacy-category',name:'Legacy'}],
      goals:[{id:'legacy-goal',name:'Legacy goal'}],transactions:[]
    })
  };
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('onboarding.js','utf8'),context);
  return context;
}

function loadUi(){
  const dom=new JSDOM('<!doctype html><div id="sheet"></div><div id="page"></div>');
  const ctx=load();
  const state={profiles:[],activeProfileId:null};
  let saved=0,rendered=0,closed=0;
  Object.assign(ctx,{
    document:dom.window.document,state,activePage:'home',
    openModal:html=>{dom.window.document.getElementById('sheet').innerHTML=html;},
    closeModal:()=>{closed++;},
    saveState:()=>{saved++;},render:()=>{rendered++;},toast:()=>{},
    activeProfile:()=>state.profiles.find(profile=>profile.id===state.activeProfileId)||null
  });
  return {ctx,dom,state,counts:()=>({saved,rendered,closed})};
}

test('starter template contains only editable example categories and no goals',()=>{
  const ctx=load();
  const source=ctx.createProfile('Test');
  source.settings.reserve={enabled:true,percent:40,limit:50000,targetBalance:300000};
  const profile=ctx.ARISE_ONBOARDING.applyTemplate(source,'starter');
  assert.deepEqual(Array.from(profile.categories,c=>c.name),['Обязательные расходы','Семья','Повседневные расходы']);
  assert.equal(profile.goals.length,0);
  assert.equal(profile.settings.onboarding.template,'starter');
  assert.equal(profile.settings.onboarding.version,2);
  assert.equal(profile.settings.onboarding.completed,false);
  assert.equal(profile.settings.reserve.enabled,false);
  assert.equal(profile.settings.reserve.percent,0);
  assert.equal(profile.settings.reserve.limit,null);
  assert.equal(profile.settings.reserve.targetBalance,null);
});

test('blank template removes categories and goals',()=>{
  const ctx=load();
  const profile=ctx.ARISE_ONBOARDING.applyTemplate(ctx.createProfile('Blank'),'blank');
  assert.equal(profile.categories.length,0);
  assert.equal(profile.goals.length,0);
  assert.equal(profile.settings.onboarding.template,'blank');
  assert.equal(profile.settings.onboarding.version,2);
  assert.equal(profile.settings.onboarding.completed,false);
});

test('template does not create a system remainder category',()=>{
  const ctx=load();
  const profile=ctx.ARISE_ONBOARDING.applyTemplate(ctx.createProfile('Test'),'starter');
  assert.equal(profile.categories.some(c=>/нераспредел|остат/i.test(c.name)),false);
  assert.equal(profile.categories.some(c=>c.name==='Свободные деньги'),false);
  assert.equal(profile.categories.every(c=>c.id&&c.enabled===true),true);
});

test('template preview states deterministic consequences before profile creation',()=>{
  const ctx=load();
  const starter=ctx.ARISE_ONBOARDING.templatePresentation('starter');
  const blank=ctx.ARISE_ONBOARDING.templatePresentation('blank');
  assert.match(starter.meta,/3 категории · 0 целей · резерв выключен/);
  assert.match(starter.detail,/Остаток после правил хранится отдельно как «Не распределено»/);
  assert.match(blank.meta,/0 категорий · 0 целей · резерв выключен/);
  assert.match(blank.detail,/новый доход будет оставаться.*«Не распределено»/);
});

test('onboarding choice updates its preview and creates the selected isolated structure',async()=>{
  const {ctx,dom,state,counts}=loadUi();
  const existing=ctx.ARISE_ONBOARDING.applyTemplate(ctx.createProfile('Основной'),'starter');
  existing.settings.onboarding.completed=true;
  existing.categories[0].name='Моя существующая категория';
  state.profiles.push(existing);state.activeProfileId=existing.id;
  ctx.ARISE_ONBOARDING.showNewProfileOnboarding();
  const document=dom.window.document;
  assert.equal(document.getElementById('onboardingTemplatePreview').dataset.onboardingTemplatePreview,'starter');
  assert.match(document.getElementById('onboardingTemplatePreview').textContent,/3 категории · 0 целей/);
  assert.equal(document.getElementById('onboardingProfileSave').textContent,'Создать с примерами');

  const blank=document.querySelector('input[name="onboardingTemplate"][value="blank"]');
  blank.checked=true;
  blank.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.equal(document.getElementById('onboardingTemplatePreview').dataset.onboardingTemplatePreview,'blank');
  assert.match(document.getElementById('onboardingTemplatePreview').textContent,/0 категорий · 0 целей/);
  assert.equal(document.getElementById('onboardingProfileSave').textContent,'Создать пустой профиль');
  assert.equal(document.querySelector('[data-onboarding-template-card="blank"]').classList.contains('is-selected'),true);

  document.getElementById('onboardingProfileName').value='Отдельный бюджет';
  document.getElementById('onboardingProfileCurrency').value='EUR';
  document.getElementById('onboardingProfileSave').click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(state.profiles.length,2);
  assert.equal(state.profiles[0].name,'Основной');
  assert.equal(state.profiles[0].categories[0].name,'Моя существующая категория');
  assert.equal(state.profiles[1].name,'Отдельный бюджет');
  assert.equal(state.profiles[1].settings.currency,'EUR');
  assert.equal(state.profiles[1].settings.onboarding.template,'blank');
  assert.equal(state.profiles[1].categories.length,0);
  assert.equal(state.activeProfileId,state.profiles[1].id);
  assert.deepEqual(counts(),{saved:1,rendered:1,closed:1});
  dom.window.close();
});

test('blank profile first run explains unallocated remainder and offers a working next step',()=>{
  const {ctx,dom,state,counts}=loadUi();
  const profile=ctx.ARISE_ONBOARDING.applyTemplate(ctx.createProfile('Blank'),'blank');
  state.profiles.push(profile);state.activeProfileId=profile.id;
  ctx.ARISE_ONBOARDING.decorateFirstRun();
  const guide=dom.window.document.getElementById('ariseFirstRunGuide');
  assert.match(guide.textContent,/Профиль создан с нуля/);
  assert.match(guide.textContent,/отдельный системный остаток, а не категория/);
  assert.equal(dom.window.document.getElementById('onboardingConfigure').textContent,'Создать первое правило');
  dom.window.document.getElementById('onboardingConfigure').click();
  assert.equal(profile.settings.onboarding.completed,true);
  assert.equal(ctx.activePage,'settings');
  assert.deepEqual(counts(),{saved:1,rendered:1,closed:0});
  dom.window.close();
});
