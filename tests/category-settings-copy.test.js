const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("priority copy avoids promising guaranteed funding",()=>{
  assert.match(source,/при нехватке денег/);
  assert.match(source,/очередь/);
  assert.doesNotMatch(source,/гарантирован/iu);
});

test("limit copy identifies a monthly cap",()=>{
  assert.match(source,/за месяц категория перестанет получать/);
  assert.match(source,/до следующего месяца/);
});
