const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("optional category controls are guarded before event binding",()=>{
  assert.match(source,/if\(!control\) return/);
});
