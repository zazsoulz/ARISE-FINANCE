const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ux=fs.readFileSync("category-settings-consequences.js","utf8");

test("category consequence layer does not relabel system unallocated funds",()=>{
  assert.equal(ux.includes("Не распределено"),false);
  assert.equal(ux.includes("unallocated"),false);
});
