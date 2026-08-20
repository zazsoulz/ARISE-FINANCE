const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("percentage and monthly limit are explained as separate rule dimensions",()=>{
  assert.match(source,/ARISE направляет \$\{percent\}% с каждого нового дохода/);
  assert.match(source,/После \$\{formatAmount\(limit\)\} за месяц/);
});
