const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category module fails safely if renderSettings is absent",()=>{
  assert.match(source,/if\(typeof oldRenderSettings!=="function"\) return/);
});
