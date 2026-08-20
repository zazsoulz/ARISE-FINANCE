const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

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

test('starter template contains only editable example categories and no goals',()=>{
  const ctx=load();
  const profile=ctx.ARISE_ONBOARDING.applyTemplate(ctx.createProfile('Test'),'starter');
  assert.deepEqual(Array.from(profile.categories,c=>c.name),['Обязательные расходы','Семья','Свободные деньги']);
  assert.equal(profile.goals.length,0);
  assert.equal(profile.settings.onboarding.template,'starter');
  assert.equal(profile.settings.onboarding.completed,false);
  assert.equal(profile.settings.reserve.enabled,false);
  assert.equal(profile.settings.reserve.targetBalance,null);
});

test('blank template removes categories and goals',()=>{
  const ctx=load();
  const profile=ctx.ARISE_ONBOARDING.applyTemplate(ctx.createProfile('Blank'),'blank');
  assert.equal(profile.categories.length,0);
  assert.equal(profile.goals.length,0);
  assert.equal(profile.settings.onboarding.template,'blank');
  assert.equal(profile.settings.onboarding.completed,true);
});

test('template does not create a system remainder category',()=>{
  const ctx=load();
  const profile=ctx.ARISE_ONBOARDING.applyTemplate(ctx.createProfile('Test'),'starter');
  assert.equal(profile.categories.some(c=>/нераспредел|остат/i.test(c.name)),false);
  assert.equal(profile.categories.every(c=>c.id&&c.enabled===true),true);
});
