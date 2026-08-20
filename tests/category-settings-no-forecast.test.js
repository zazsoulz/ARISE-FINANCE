const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8").toLowerCase();

test("category rule preview does not invent future income forecasts",()=>{
  assert.equal(source.includes("forecast"),false);
  assert.equal(source.includes("прогноз"),false);
});
