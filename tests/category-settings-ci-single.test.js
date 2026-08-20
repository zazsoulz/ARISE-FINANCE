const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const workflow=fs.readFileSync(".github/workflows/test.yml","utf8");

test("category consequence syntax gate is not duplicated",()=>{
  assert.equal(workflow.split("node --check category-settings-consequences.js").length-1,1);
});
