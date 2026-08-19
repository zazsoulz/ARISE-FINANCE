(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(root) root.ARISE_EXPENSE_RECONCILIATION=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const integer=value=>Number.isFinite(Number(value))?Math.round(Number(value)):0;
  const nonneg=value=>Math.max(0,integer(value));

  function reconcileExpense({amount,categoryId,availableUnallocated}){
    const total=nonneg(amount);
    const normalizedCategoryId=categoryId||null;

    if(normalizedCategoryId){
      return {
        fundingSource:"category",
        fundingSourceId:normalizedCategoryId,
        controlledAmount:total,
        uncontrolledAmount:0
      };
    }

    const available=nonneg(availableUnallocated);
    const controlledAmount=Math.min(total,available);

    return {
      fundingSource:"unallocated",
      fundingSourceId:null,
      controlledAmount,
      uncontrolledAmount:Math.max(0,total-controlledAmount)
    };
  }

  return {reconcileExpense};
});
