const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("disabled state is handled before rule-type explanation",()=>{
  const disabled=source.indexOf("if(!enabled)");
  const fixed=source.indexOf('if(type==="fixed")');
  assert.ok(disabled>=0);
  assert.ok(fixed>disabled);
});
