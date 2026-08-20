const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("category consequence feature has runtime, loader, CI and product contract",()=>{
  assert.ok(fs.existsSync("category-settings-consequences.js"));
  assert.ok(fs.existsSync("docs/CATEGORY_RULES_UX.md"));
  assert.match(fs.readFileSync("index.html","utf8"),/category-settings-consequences\.js/);
  assert.match(fs.readFileSync(".github/workflows/test.yml","utf8"),/node --check category-settings-consequences\.js/);
});
