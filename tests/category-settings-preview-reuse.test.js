const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category preview reuses an existing consequence node",()=>{
  assert.match(source,/querySelector\("\.category-consequence"\)/);
  assert.match(source,/if\(preview\) return preview/);
});
