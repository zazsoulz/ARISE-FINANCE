const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("disabling a category does not disable its editor controls",()=>{
  assert.doesNotMatch(source,/\.disabled\s*=/);
  assert.doesNotMatch(source,/setAttribute\(["']disabled/);
});
