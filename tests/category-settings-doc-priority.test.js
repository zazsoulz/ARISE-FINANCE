const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const doc=fs.readFileSync("docs/CATEGORY_RULES_UX.md","utf8");

test("category priority documentation does not imply guaranteed money",()=>{
  assert.match(doc,/when available money cannot satisfy every rule/);
  assert.match(doc,/does not manufacture extra money or guarantee funding/);
});
