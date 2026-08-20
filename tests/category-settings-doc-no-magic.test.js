const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const doc=fs.readFileSync("docs/CATEGORY_RULES_UX.md","utf8");

test("category UX documentation explicitly rejects name-driven behavior",()=>{
  assert.match(doc,/never financial behavior/);
  assert.match(doc,/rename, add, disable, or delete ordinary categories/);
});
