const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category preview reuses the existing notice visual language",()=>{
  assert.match(source,/preview\.className="category-consequence notice"/);
});
