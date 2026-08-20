const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");

test("category consequence module is loaded exactly once",()=>{
  assert.equal(html.split("./category-settings-consequences.js").length-1,1);
});
