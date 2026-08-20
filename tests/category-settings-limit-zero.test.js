const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("blank limit is distinct from an explicit zero monthly limit",()=>{
  assert.match(source,/rawLimit===""\?null:amount\(rawLimit\)/);
  assert.match(source,/limit===null/);
});
