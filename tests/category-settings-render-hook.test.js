const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category consequence hook preserves renderSettings return value",()=>{
  assert.match(source,/const result=oldRenderSettings\.apply\(this,arguments\)/);
  assert.match(source,/return result/);
});
