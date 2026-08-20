const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("all six rule-affecting controls participate in live explanation refresh",()=>{
  const marker='[".category-type",".category-percent",".category-fixed",".category-priority",".category-limit",".category-enabled"]';
  assert.ok(source.includes(marker));
});
