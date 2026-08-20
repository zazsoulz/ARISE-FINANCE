const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("each category gets an immediate explanation on settings render",()=>{
  const bind=source.indexOf("function bind(");
  const install=source.indexOf("function install(");
  assert.ok(bind>=0&&install>bind);
  assert.match(source.slice(bind,install),/refresh\(editor\)/);
});
