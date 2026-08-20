const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shell=fs.readFileSync("app-shell.html","utf8");

test("category editor retains explicit participation toggle",()=>{
  assert.match(shell,/class="category-enabled"/);
  assert.match(shell,/Категория участвует/);
});
