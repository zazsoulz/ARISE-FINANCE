const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category settings explanation does not call planning or ledger APIs",()=>{
  for(const token of ["proposeIncomePlan","validatePlan","monthStats","createIncomeTransaction","createExpenseTransaction"]){
    assert.equal(source.includes(token),false,`unexpected ${token}`);
  }
});
