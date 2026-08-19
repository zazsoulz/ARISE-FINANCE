(function(root){
  "use strict";
  const api=root.ARISE_V3;
  if(!api||typeof api.groupMonth!=="function") return;
  const internalGroupMonth=api.groupMonth;
  api.groupMonth=function(profile,month){
    const data=internalGroupMonth(profile,month);
    const {uncontrolled,...publicData}=data;
    return publicData;
  };
})(typeof globalThis!=="undefined"?globalThis:window);
