const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("remainder category is not presented as the system unallocated balance",()=>{
  assert.match(source,/Категория получает только остаток/);
  assert.doesNotMatch(source,/Не распределено/);
  assert.doesNotMatch(source,/системн.*остат/iu);
});
