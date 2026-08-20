const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category consequence appears next to the rule before enabled toggle",()=>{
  assert.match(source,/querySelector\("\.check"\)/);
  assert.match(source,/insertAdjacentElement\("beforebegin",preview\)/);
});
