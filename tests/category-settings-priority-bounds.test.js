const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category priority explanation has high low and neutral cases",()=>{
  assert.match(source,/priority>=5/);
  assert.match(source,/priority<=2/);
  assert.match(source,/Приоритет определяет очередь/);
});
