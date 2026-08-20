const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("non-fixed non-percentage category falls back to residual explanation",()=>{
  assert.match(source,/else\{\s*rule="Категория получает только остаток/);
});
