const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category UX module follows existing browser-global module convention",()=>{
  assert.match(source,/\}\)\(typeof globalThis!=="undefined"\?globalThis:window\);/);
});
