const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category consequence module remains compact and focused",()=>{
  const lines=source.split(/\r?\n/).length;
  assert.ok(lines<180,`module grew to ${lines} lines`);
});
