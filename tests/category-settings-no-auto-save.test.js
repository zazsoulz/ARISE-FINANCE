const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("live consequence refresh does not auto-save category edits",()=>{
  assert.doesNotMatch(source,/click\s*\(/);
  assert.doesNotMatch(source,/saveCategories/);
  assert.doesNotMatch(source,/saveState/);
});
