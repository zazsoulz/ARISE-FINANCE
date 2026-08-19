(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(root) root.ARISE_RESERVE_ANALYTICS=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const amount=value=>Number.isFinite(Number(value))?Math.max(0,Math.round(Number(value))):0;

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

  return {reserveRunway};
});
