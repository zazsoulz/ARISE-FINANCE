const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category consequence logic never reads the category name field",()=>{
  assert.equal(source.includes(".category-name"),false);
});
