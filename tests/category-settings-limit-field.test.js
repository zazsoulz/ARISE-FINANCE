const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shell=fs.readFileSync("app-shell.html","utf8");

test("category editor exposes an optional numeric limit",()=>{
  assert.match(shell,/class="category-limit"/);
  assert.match(shell,/placeholder="Без лимита"/);
});
