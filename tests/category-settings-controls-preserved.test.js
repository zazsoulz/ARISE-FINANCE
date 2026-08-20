const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category consequence module does not replace editor markup",()=>{
  assert.doesNotMatch(source,/editor\.innerHTML\s*=/);
  assert.doesNotMatch(source,/editor\.outerHTML\s*=/);
});
