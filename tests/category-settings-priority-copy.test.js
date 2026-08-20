const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("priority consequence copy explains both earlier and later service",()=>{
  assert.match(source,/обслуживается раньше большинства остальных/);
  assert.match(source,/могут забрать доступную сумму раньше/);
});
