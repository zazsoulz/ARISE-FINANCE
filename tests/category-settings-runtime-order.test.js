const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");

test("category settings consequence layer runs before settings-currency guard and bootstrap",()=>{
  const consequence=html.indexOf("./category-settings-consequences.js");
  const guard=html.indexOf("./settings-currency-guard.js");
  const bootstrap=html.indexOf("./financial-bootstrap.js");
  assert.ok(consequence>=0);
  assert.ok(guard>consequence);
  assert.ok(bootstrap>guard);
});
