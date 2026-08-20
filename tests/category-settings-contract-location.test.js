const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("category rule UX contract is kept with product documentation",()=>{
  assert.ok(fs.existsSync("docs/CATEGORY_RULES_UX.md"));
});
