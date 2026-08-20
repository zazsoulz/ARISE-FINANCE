const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("invalid or empty priority has a safe minimum explanation value",()=>{
  assert.match(source,/Math\.max\(1,amount\(value\(editor,"\.category-priority"\)\)\|\|1\)/);
});
