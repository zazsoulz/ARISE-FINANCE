const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("category consequence module is loaded after v3 settings override and before bootstrap",()=>{
  const html=fs.readFileSync("index.html","utf8");
  const v3=html.indexOf("./arise-v3.js");
  const consequences=html.indexOf("./category-settings-consequences.js");
  const bootstrap=html.indexOf("./financial-bootstrap.js");
  assert.ok(v3>=0);
  assert.ok(consequences>v3);
  assert.ok(bootstrap>consequences);
});
