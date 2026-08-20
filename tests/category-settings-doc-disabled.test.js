const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const doc=fs.readFileSync("docs/CATEGORY_RULES_UX.md","utf8");

test("disabled category documentation preserves history",()=>{
  assert.match(doc,/stops future automatic allocation without rewriting historical transactions/);
});
