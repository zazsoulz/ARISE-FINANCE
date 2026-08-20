const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8").toLowerCase();

test("category consequence layer does not own goal or reserve calculations",()=>{
  assert.equal(source.includes("goalbalance"),false);
  assert.equal(source.includes("reservebalance"),false);
  assert.equal(source.includes("goalallocation"),false);
});
