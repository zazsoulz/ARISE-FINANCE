const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shell=fs.readFileSync("app-shell.html","utf8");
const doc=fs.readFileSync("docs/CATEGORY_RULES_UX.md","utf8");

test("category name remains a freely editable field",()=>{
  assert.match(shell,/class="category-name"/);
  assert.match(shell,/category\.name\s*=/);
  assert.match(doc,/Category names are user content/);
});
