const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("empty category limit is explained explicitly",()=>{
  assert.match(source,/Месячного лимита нет/);
});
