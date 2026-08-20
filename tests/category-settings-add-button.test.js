const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shell=fs.readFileSync("app-shell.html","utf8");

test("users can still create ordinary categories",()=>{
  assert.match(shell,/id="addCategory"/);
  assert.match(shell,/\+ Категория/);
});
