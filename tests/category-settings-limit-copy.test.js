const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("monthly cap copy explains when automatic allocation resumes",()=>{
  assert.match(source,/до следующего месяца/);
});
