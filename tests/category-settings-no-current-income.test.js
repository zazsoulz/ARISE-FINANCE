const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category rule preview does not depend on current income transaction state",()=>{
  assert.doesNotMatch(source,/currentIncomePlan/);
  assert.doesNotMatch(source,/incomeAmount/);
  assert.doesNotMatch(source,/monthTransactions/);
});
