const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shell=fs.readFileSync("app-shell.html","utf8");

test("category settings still require explicit save",()=>{
  assert.match(shell,/id="saveCategories"/);
  assert.match(shell,/Сохранить категории/);
});
