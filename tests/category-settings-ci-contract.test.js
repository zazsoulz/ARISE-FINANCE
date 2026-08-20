const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("CI syntax-checks category consequence module",()=>{
  const workflow=fs.readFileSync(".github/workflows/test.yml","utf8");
  assert.match(workflow,/node --check category-settings-consequences\.js/);
});
