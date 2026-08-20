const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category feedback reacts before save to input and change events",()=>{
  assert.match(source,/control\.addEventListener\("input",\(\)=>refresh\(editor\)\)/);
  assert.match(source,/control\.addEventListener\("change",\(\)=>refresh\(editor\)\)/);
});
