(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(root) root.ARISE_RESERVE_ANALYTICS=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const amount=value=>Number.isFinite(Number(value))?Math.max(0,Math.round(Number(value))):0;
  const owns=(object,key)=>!!object&&Object.prototype.hasOwnProperty.call(object,key);

  function reserveRunway({reserveBalance,monthlyEssentialSpend}={}){
    const balance=amount(reserveBalance);
    const monthlySpend=amount(monthlyEssentialSpend);

    if(monthlySpend<=0){
      return {
        status:"insufficient_data",
        reserveBalance:balance,
        monthlyEssentialSpend:monthlySpend,
        months:null,
        wholeMonths:null,
        remainder:balance
      };
    }

    const months=balance/monthlySpend;
    return {
      status:"ok",
      reserveBalance:balance,
      monthlyEssentialSpend:monthlySpend,
      months,
      wholeMonths:Math.floor(months),
      remainder:balance%monthlySpend
    };
  }

  function reserveProgress({reserveBalance,targetBalance}={}){
    const balance=amount(reserveBalance);
    const target=amount(targetBalance);

    if(target<=0){
      return {
        status:"no_target",
        reserveBalance:balance,
        targetBalance:target,
        remaining:null,
        progress:null,
        percent:null,
        complete:false,
        surplus:0
      };
    }

    const remaining=Math.max(0,target-balance);
    const surplus=Math.max(0,balance-target);
    const progress=Math.min(1,balance/target);

    return {
      status:"ok",
      reserveBalance:balance,
      targetBalance:target,
      remaining,
      progress,
      percent:progress*100,
      complete:balance>=target,
      surplus
    };
  }

  function reserveTarget(settings={}){
    const source=settings&&typeof settings==="object"?settings:{};
    return amount(owns(source,"targetBalance")?source.targetBalance:source.target);
  }

  function normalizeTargetSettings(settings={}){
    const source=settings&&typeof settings==="object"?settings:{};
    const next={...source};
    let changed=false;

    if(owns(source,"targetBalance")){
      if(owns(source,"target")){
        delete next.target;
        changed=true;
      }
    }else if(owns(source,"target")){
      next.targetBalance=amount(source.target);
      delete next.target;
      changed=true;
    }

    return {settings:next,targetBalance:reserveTarget(next),changed};
  }

  return {reserveRunway,reserveProgress,reserveTarget,normalizeTargetSettings};
});