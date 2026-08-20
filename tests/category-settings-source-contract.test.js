const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category consequence copy covers rule semantics without a second planner",()=>{
  assert.match(source,/с каждого нового дохода/);
  assert.match(source,/Месячного лимита нет/);
  assert.match(source,/Приоритет определяет очередь/);
  assert.match(source,/Уже сохранённые операции не меняются/);
  assert.doesNotMatch(source,/ARISE_FINANCE_CORE/);
  assert.doesNotMatch(source,/allocateIncome\s*\(/);
});

test("category editor hides irrelevant fixed or percent field",()=>{
  assert.match(source,/type==="percentage"/);
  assert.match(source,/type==="fixed"/);
  assert.match(source,/style\.display/);
});
