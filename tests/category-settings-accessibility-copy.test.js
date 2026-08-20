const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category explanation has a visible title and readable supporting copy",()=>{
  assert.match(source,/<strong>\$\{info\.title\}<\/strong>/);
  assert.match(source,/line-height:1\.55/);
});
