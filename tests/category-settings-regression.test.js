const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const moduleSource=fs.readFileSync("category-settings-consequences.js","utf8");

test("consequence layer never identifies a category by a magic name",()=>{
  assert.doesNotMatch(moduleSource,/Свободные деньги/);
  assert.doesNotMatch(moduleSource,/Обязательные расходы/);
  assert.doesNotMatch(moduleSource,/Семья/);
});

test("consequence layer does not save or mutate profile financial state",()=>{
  assert.doesNotMatch(moduleSource,/saveState\s*\(/);
  assert.doesNotMatch(moduleSource,/profile\.categories\s*=/);
  assert.doesNotMatch(moduleSource,/transactions\.push\s*\(/);
});
