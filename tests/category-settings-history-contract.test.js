const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("disabled-category explanation explicitly protects historical meaning",()=>{
  assert.match(source,/Уже сохранённые операции не меняются/);
  assert.doesNotMatch(source,/пересчита/iu);
});
