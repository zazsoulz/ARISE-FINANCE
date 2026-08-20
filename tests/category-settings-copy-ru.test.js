const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category consequence UI is user-facing Russian copy",()=>{
  assert.match(source,/Что изменит это правило/);
  assert.match(source,/Не участвует в автоматическом распределении/);
  assert.match(source,/Месячного лимита нет/);
  assert.doesNotMatch(source,/allocation engine/i);
});
