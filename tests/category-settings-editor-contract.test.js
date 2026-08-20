const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const shell=fs.readFileSync("app-shell.html","utf8");

test("category settings remain ordinary editable user rules",()=>{
  assert.match(shell,/class="category-name"/);
  assert.match(shell,/class="category-type"/);
  assert.match(shell,/class="category-percent"/);
  assert.match(shell,/class="category-fixed"/);
  assert.match(shell,/class="category-priority"/);
  assert.match(shell,/class="category-limit"/);
  assert.match(shell,/class="category-enabled"/);
});

test("category save persists rule fields rather than magic category names",()=>{
  const start=shell.indexOf("function saveCategoriesFromUI");
  assert.ok(start>=0);
  const body=shell.slice(start,start+5000);
  assert.match(body,/category\.type\s*=/);
  assert.match(body,/category\.percent\s*=/);
  assert.match(body,/category\.fixedAmount\s*=/);
  assert.match(body,/category\.priority\s*=/);
  assert.match(body,/category\.limit\s*=/);
  assert.match(body,/category\.enabled\s*=/);
  assert.doesNotMatch(body,/category\.name\s*===\s*["']Свободные деньги/);
});
