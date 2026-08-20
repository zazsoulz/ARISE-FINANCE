const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const doc=fs.readFileSync("docs/CATEGORY_RULES_UX.md","utf8");

test("category consequence layer is documented as explanatory only",()=>{
  assert.match(doc,/explanatory only/);
  assert.match(doc,/must not introduce a second planner or mutate the financial proposal/);
});
