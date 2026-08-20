const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category explanation layer owns no storage or network path",()=>{
  for(const forbidden of ["localStorage","indexedDB","supabase","fetch(","saveState(","sync"]){
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()),false,`unexpected ${forbidden}`);
  }
});
