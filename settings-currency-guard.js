(function(root){
  "use strict";

  const previousRenderSettings=root.renderSettings;
  const lifecycle=root.ARISE_PROFILE_LIFECYCLE;
  if(typeof previousRenderSettings!=="function"||!lifecycle)return;

  function active(){
    try{return typeof activeProfile==="function"?activeProfile():null;}catch(_){return null;}
  }

  function lockCurrencyControl(profile){
    const select=typeof document!=="undefined"&&document.getElementById("settingsCurrency");
    if(!select||!profile)return;
    const locked=!!lifecycle.hasFinancialHistory(profile);
    select.disabled=locked;
    select.value=profile.settings&&profile.settings.currency||"RUB";
    select.dataset.currencyLocked=locked?"true":"false";
    const field=select.closest&&select.closest(".field");
    if(field){
      const old=field.querySelector("[data-settings-currency-note]");
      if(old)old.remove();
      const note=document.createElement("div");
      note.dataset.settingsCurrencyNote="true";
      note.className=`tiny ${locked?"warning":"muted"}`;
      note.style.marginTop="7px";
      note.textContent=locked
        ?"Базовая валюта зафиксирована после появления финансовой истории. Исходная валюта операций хранится отдельно."
        :"Базовую валюту можно менять, пока в профиле нет финансовой истории.";
      field.appendChild(note);
    }
  }

  function protectLegacySave(profile){
    const button=typeof document!=="undefined"&&document.getElementById("saveProfileSettings");
    const select=typeof document!=="undefined"&&document.getElementById("settingsCurrency");
    if(!button||!select||!profile||button.__ariseCurrencyGuard)return;
    const original=button.onclick;
    button.onclick=event=>{
      const current=profile.settings&&profile.settings.currency||"RUB";
      const requested=select.value;
      if(!lifecycle.canChangeBaseCurrency(profile,requested)){
        select.value=current;
        lockCurrencyControl(profile);
        if(typeof toast==="function")toast("Базовую валюту нельзя менять после появления финансовой истории.");
      }
      return typeof original==="function"?original.call(button,event):undefined;
    };
    button.__ariseCurrencyGuard=true;
  }

  root.renderSettings=function(){
    previousRenderSettings();
    const profile=active();
    lockCurrencyControl(profile);
    protectLegacySave(profile);
  };

  root.ARISE_SETTINGS_CURRENCY_GUARD={lockCurrencyControl,protectLegacySave};
})(typeof globalThis!=="undefined"?globalThis:window);
