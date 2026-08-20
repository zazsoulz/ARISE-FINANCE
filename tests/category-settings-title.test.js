const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("enabled category preview uses consequence-oriented title",()=>{
  assert.match(source,/title:"Что изменит это правило"/);
});
