const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("percentage rule is not mislabeled as a one-time monthly percentage",()=>{
  assert.match(source,/с каждого нового дохода/);
  assert.doesNotMatch(source,/один раз в месяц/iu);
});
