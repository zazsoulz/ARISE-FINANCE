const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shell=fs.readFileSync("app-shell.html","utf8");

test("category editor retains fixed amount input",()=>{
  assert.match(shell,/class="category-fixed"/);
  assert.match(shell,/Фиксированная сумма/);
});
