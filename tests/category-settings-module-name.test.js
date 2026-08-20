const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("category consequence module and loader use the same filename",()=>{
  assert.ok(fs.existsSync("category-settings-consequences.js"));
  assert.match(fs.readFileSync("index.html","utf8"),/\.\/category-settings-consequences\.js/);
});
