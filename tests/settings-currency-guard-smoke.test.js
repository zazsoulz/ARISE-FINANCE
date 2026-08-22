const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function boot({withHistory}){
  const dom=new JSDOM('<!doctype html><div id="page"></div>');
  const profile={settings:{currency:'RUB'},transactions:withHistory?[{id:'t1',type:'income',amount:1000}]:[],goals:[]};
  let toastText='';
  const ctx={console,document:dom.window.document,window:null,globalThis:null,
    state:{profiles:[],activeProfileId:null},
    activeProfile:()=>profile,toast:text=>{toastText=text;},
    renderSettings:()=>{
      dom.window.document.getElementById('page').innerHTML='<div class="field"><label>Основная валюта</label><select id="settingsCurrency"><option value="RUB">RUB</option><option value="EUR">EUR</option><option value="USD">USD</option></select></div><button id="saveProfileSettings">Сохранить</button>';
      const select=dom.window.document.getElementById('settingsCurrency');select.value=profile.settings.currency;
      dom.window.document.getElementById('saveProfileSettings').onclick=()=>{profile.settings.currency=select.value;};
    }
  };
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('profile-lifecycle.js','utf8'),ctx,{filename:'profile-lifecycle.js'});
  vm.runInContext(fs.readFileSync('settings-ui.js','utf8'),ctx,{filename:'settings-ui.js'});
  return {ctx,dom,profile,toast:()=>toastText};
}

test('legacy settings cannot bypass base currency lock after history exists',()=>{
  const {ctx,dom,profile,toast}=boot({withHistory:true});ctx.renderSettings();
  const select=dom.window.document.getElementById('settingsCurrency');
  assert.equal(select.disabled,true);assert.equal(select.dataset.currencyLocked,'true');
  select.disabled=false;select.value='EUR';dom.window.document.getElementById('saveProfileSettings').click();
  assert.equal(profile.settings.currency,'RUB');assert.match(toast(),/нельзя менять/);
});

test('empty profile can still change base currency from legacy settings',()=>{
  const {ctx,dom,profile}=boot({withHistory:false});ctx.renderSettings();
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
