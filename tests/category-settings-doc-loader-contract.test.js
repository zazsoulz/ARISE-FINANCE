const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("documented category rule types are represented by runtime consequence logic",()=>{
  const doc=fs.readFileSync("docs/CATEGORY_RULES_UX.md","utf8");
  const source=fs.readFileSync("category-settings-consequences.js","utf8");
  for(const token of ["fixed","percentage","remainder"]){
    assert.ok(source.includes(`type===\"${token}\"`)||source.includes(`type==\"${token}\"`));
  }
  assert.match(doc,/Priority/);
  assert.match(source,/priority/);
});
