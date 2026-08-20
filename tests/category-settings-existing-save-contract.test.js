const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shell=fs.readFileSync("app-shell.html","utf8");
const ux=fs.readFileSync("category-settings-consequences.js","utf8");

test("existing saveCategoriesFromUI remains the persistence owner",()=>{
  assert.match(shell,/function saveCategoriesFromUI\(\)/);
  assert.match(shell,/"saveCategories"/);
  assert.doesNotMatch(ux,/saveCategoriesFromUI\s*=/);
});
