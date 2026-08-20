const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("percentage and fixed inputs are mutually contextual",()=>{
  assert.match(source,/percent\.style\.display=type==="percentage"\?"":"none"/);
  assert.match(source,/fixed\.style\.display=type==="fixed"\?"":"none"/);
});
