const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("remainder explanation still composes with priority context",()=>{
  assert.match(source,/Категория получает только остаток/);
  assert.match(source,/rule\+cap\+priorityText/);
});
