const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("disabled category copy describes future automatic allocation only",()=>{
  assert.match(source,/Новые доходы не будут направляться/);
  assert.match(source,/пока ты снова её не включишь/);
});
