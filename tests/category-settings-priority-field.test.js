const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shell=fs.readFileSync("app-shell.html","utf8");

test("category editor exposes priority independently of category name",()=>{
  assert.match(shell,/class="category-priority"/);
  assert.match(shell,/Приоритет/);
});
