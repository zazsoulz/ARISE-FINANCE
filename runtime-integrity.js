(function(root){
  "use strict";

  function verify(){
    const core=root.ARISE_FINANCE_CORE;
    const required=["planIncome","monthStats","availableFree","reserveBalance","goalBalance","validatePlan"];
    const missing=required.filter(name=>!core||typeof core[name]!=="function");
    const legacyStripped=root.__ARISE_LEGACY_FINANCIAL_STRIPPED__===true;
    const ok=legacyStripped&&missing.length===0;
    return {
      ok,
      legacyStripped,
      missing,
      engine:"ARISE_FINANCE_CORE",
      checkedAt:new Date().toISOString()
    };
  }

  const api={verify,last:null};
  api.last=verify();
  root.ARISE_RUNTIME_INTEGRITY=api;
})(typeof globalThis!=="undefined"?globalThis:window);
