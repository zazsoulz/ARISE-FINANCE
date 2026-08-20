const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const doc=fs.readFileSync("docs/CATEGORY_RULES_UX.md","utf8");

test("category rule documentation defines percentage monthly cap",()=>{
  assert.match(doc,/optional monthly limit caps further automatic allocation/);
});
