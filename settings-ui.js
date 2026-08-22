(function(root){
  "use strict";

  const baseRenderSettings=root.renderSettings;
  if(typeof baseRenderSettings!=="function") return;

  function enhanceAccountSettings(){
    const module=root.ARISE_ACCOUNT_SETTINGS;
    if(module&&typeof module.enhanceSettings==="function") module.enhanceSettings();
  }

  function enhanceProfileSettings(){
    const module=root.ARISE_PROFILE_LIFECYCLE;
    if(module&&typeof module.enhanceSettings==="function") module.enhanceSettings();
  }

  function renderSettings(){
    baseRenderSettings();
    enhanceAccountSettings();
    enhanceProfileSettings();
  }

  root.renderSettings=renderSettings;
  root.ARISE_SETTINGS_UI={renderSettings,enhanceAccountSettings,enhanceProfileSettings};
})(typeof globalThis!=="undefined"?globalThis:window);
