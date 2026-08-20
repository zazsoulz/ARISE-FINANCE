const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const doc=fs.readFileSync("docs/CATEGORY_RULES_UX.md","utf8");

test("category UX contract requires contextual controls",()=>{
  assert.match(doc,/Only controls relevant to the selected rule type should be visually active/);
});
