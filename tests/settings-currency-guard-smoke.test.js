const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function boot({withHistory}){
  const dom=new JSDOM('<!doctype html><div class="field"><label>Основная валюта</label><select id="settingsCurrency"><option value="RUB">RUB</option><option value="EUR">EUR</option><option value="USD">USD</option></select></div><button id="saveProfileSettings">Сохранить</button>');
  const profile={settings:{currency:'RUB'},transactions:withHistory?[{id:'t1',type:'income',amount:1000}]:[],goals:[]};
  let toastText='';
  const ctx={console,document:dom.window.document,window:null,globalThis:null,state:{profiles:[profile],activeProfileId:'p1'},activeProfile:()=>profile,toast:text=>{toastText=text;}};
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('profile-lifecycle.js','utf8'),ctx,{filename:'profile-lifecycle.js'});
  const select=dom.window.document.getElementById('settingsCurrency');select.value=profile.settings.currency;
  const save=dom.window.document.getElementById('saveProfileSettings');
  save.onclick=()=>{profile.settings.currency=select.value;};
  ctx.ARISE_SETTINGS_CURRENCY_GUARD.lockCurrencyControl(profile);
  ctx.ARISE_SETTINGS_CURRENCY_GUARD.protectLegacySave(profile);
  return {ctx,dom,profile,toast:()=>toastText};
}

test('canonical settings cannot bypass base currency lock after history exists',()=>{
  const {dom,profile,toast}=boot({withHistory:true});
  const select=dom.window.document.getElementById('settingsCurrency');
  assert.equal(select.disabled,true);assert.equal(select.dataset.currencyLocked,'true');
  select.disabled=false;select.value='EUR';dom.window.document.getElementById('saveProfileSettings').click();
  assert.equal(profile.settings.currency,'RUB');assert.match(toast(),/нельзя менять/);
});

test('empty profile can still change base currency from canonical settings',()=>{
  const {dom,profile}=boot({withHistory:false});
  const select=dom.window.document.getElementById('settingsCurrency');
  assert.equal(select.disabled,false);assert.equal(select.dataset.currencyLocked,'false');
  select.value='USD';dom.window.document.getElementById('saveProfileSettings').click();
  assert.equal(profile.settings.currency,'USD');
});

test('currency guard is exported by profile lifecycle and standalone layer stays retired',()=>{
  const {ctx}=boot({withHistory:false});
  assert.equal(typeof ctx.ARISE_SETTINGS_CURRENCY_GUARD?.lockCurrencyControl,'function');
  assert.equal(typeof ctx.ARISE_SETTINGS_CURRENCY_GUARD?.protectLegacySave,'function');
  assert.equal(fs.existsSync('settings-currency-guard.js'),false);
});
