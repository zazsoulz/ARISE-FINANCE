const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category controls are not rebound repeatedly across settings refreshes",()=>{
  assert.match(source,/editor\.dataset\.consequenceBound==="1"/);
  assert.match(source,/editor\.dataset\.consequenceBound="1"/);
});
