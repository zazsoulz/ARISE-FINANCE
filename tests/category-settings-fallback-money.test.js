const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("standalone fallback remains display-only",()=>{
  assert.match(source,/new Intl\.NumberFormat\("ru-RU"\)/);
  assert.match(source,/\+" ₽"/);
});
