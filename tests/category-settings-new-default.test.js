const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shell=fs.readFileSync("app-shell.html","utf8");

test("new category starts as an ordinary editable percentage rule",()=>{
  const add=shell.indexOf('"addCategory"');
  const body=shell.slice(add,add+1200);
  assert.match(body,/"Новая категория"/);
  assert.match(body,/"percentage"/);
  assert.match(body,/5/);
});
