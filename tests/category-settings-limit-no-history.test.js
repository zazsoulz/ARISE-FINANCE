const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category limit preview does not pretend to know historical usage",()=>{
  assert.doesNotMatch(source,/уже использовано/iu);
  assert.doesNotMatch(source,/осталось до лимита/iu);
});
