const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("disabled category preview receives a distinct notice state",()=>{
  assert.match(source,/info\.tone==="muted"\?" warning":""/);
});
