const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category consequence preview has no asynchronous dependency",()=>{
  assert.equal(source.includes("async function"),false);
  assert.equal(source.includes("await "),false);
});
