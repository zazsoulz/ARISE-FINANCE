const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("category consequence UX reuses existing notice styles without a new stylesheet",()=>{
  const html=fs.readFileSync("index.html","utf8");
  assert.equal(html.includes("category-settings-consequences.css"),false);
});
