const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category consequence feedback is inline rather than alert-driven",()=>{
  assert.doesNotMatch(source,/alert\s*\(/);
  assert.doesNotMatch(source,/confirm\s*\(/);
  assert.doesNotMatch(source,/prompt\s*\(/);
});
