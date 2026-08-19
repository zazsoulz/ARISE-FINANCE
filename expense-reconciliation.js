(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(root) root.ARISE_EXPENSE_RECONCILIATION=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const integer=value=>Number.isFinite(Number(value))?Math.round(Number(value)):0;
  const nonneg=value=>Math.max(0,integer(value));

  function reconcileExpense({amount,categoryId,availableUnallocated,availableCategory}){
    const total=nonneg(amount);
    const normalizedCategoryId=categoryId||null;
    const categoryAvailable=normalizedCategoryId?nonneg(availableCategory):0;
    const unallocatedAvailable=nonneg(availableUnallocated);

    const categoryAmount=Math.min(total,categoryAvailable);
    const afterCategory=total-categoryAmount;
    const unallocatedAmount=Math.min(afterCategory,unallocatedAvailable);
    const uncontrolledAmount=Math.max(0,afterCategory-unallocatedAmount);
    const controlledAmount=categoryAmount+unallocatedAmount;

    return {
      fundingSource:normalizedCategoryId?"category":"unallocated",
      fundingSourceId:normalizedCategoryId,
      controlledAmount,
      categoryControlledAmount:categoryAmount,
      unallocatedControlledAmount:unallocatedAmount,
      uncontrolledAmount,
      fundingBreakdown:{
        category:categoryAmount,
        unallocated:unallocatedAmount,
        uncontrolled:uncontrolledAmount
      }
    };
  }

  return {reconcileExpense};
});