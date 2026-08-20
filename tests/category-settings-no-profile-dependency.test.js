const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category explanation derives from editor values, not hidden profile state",()=>{
  assert.doesNotMatch(source,/activeProfile\s*\(/);
  assert.doesNotMatch(source,/state\.profiles/);
});
