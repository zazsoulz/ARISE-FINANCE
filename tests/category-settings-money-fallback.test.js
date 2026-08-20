const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category preview can format amounts without owning currency logic",()=>{
  assert.match(source,/typeof root\.money==="function"/);
  assert.match(source,/Intl\.NumberFormat/);
  assert.doesNotMatch(source,/exchangeRate/);
  assert.doesNotMatch(source,/baseAmount/);
});
