const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("fixed rule is explicitly monthly",()=>{
  assert.match(source,/до \$\{formatAmount\(fixed\)\} в месяц/);
});
