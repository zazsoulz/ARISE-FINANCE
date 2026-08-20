const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shell=fs.readFileSync("app-shell.html","utf8");

test("category editor retains fixed percentage and remainder rule choices",()=>{
  for(const type of ["fixed","percentage","remainder"]){
    assert.ok(shell.includes(`value="${type}"`));
  }
});
