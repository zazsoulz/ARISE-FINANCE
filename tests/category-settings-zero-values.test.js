const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("zero fixed and percentage rules have explicit no-allocation copy",()=>{
  assert.match(source,/Фиксированная сумма сейчас равна нулю/);
  assert.match(source,/Процент сейчас равен нулю/);
  assert.match(source,/автоматического пополнения по этому правилу не будет/);
});
