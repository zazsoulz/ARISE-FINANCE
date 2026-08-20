const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("category UX contract keeps names non-semantic and consequence layer explanatory",()=>{
  const doc=fs.readFileSync("docs/CATEGORY_RULES_UX.md","utf8");
  assert.match(doc,/names are user content, never financial behavior/i);
  assert.match(doc,/Fixed/);
  assert.match(doc,/Percentage/);
  assert.match(doc,/Remainder/);
  assert.match(doc,/Priority/);
  assert.match(doc,/Disabled/);
  assert.match(doc,/must not introduce a second planner/i);
});
