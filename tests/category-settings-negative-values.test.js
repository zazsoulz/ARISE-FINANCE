const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category explanation normalizes numeric values to non-negative integers",()=>{
  assert.match(source,/Math\.max\(0,Math\.round\(Number\(value\)\|\|0\)\)/);
});
