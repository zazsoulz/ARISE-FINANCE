const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shell=fs.readFileSync("app-shell.html","utf8");
const ux=fs.readFileSync("category-settings-consequences.js","utf8");

test("new category rerender flows through the consequence binder",()=>{
  assert.match(shell,/"addCategory"/);
  assert.match(shell,/saveState\(\);\s*render\(\);/);
  assert.match(ux,/root\.renderSettings=function/);
  assert.match(ux,/bind\(document\)/);
});
