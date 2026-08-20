const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("zero percentage category does not promise an allocation",()=>{
  assert.match(source,/Процент сейчас равен нулю/);
});
