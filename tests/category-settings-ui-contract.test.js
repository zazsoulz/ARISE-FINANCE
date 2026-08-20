const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("settings preview reacts to every financial category control",()=>{
  for(const selector of [".category-type",".category-percent",".category-fixed",".category-priority",".category-limit",".category-enabled"]){
    assert.ok(source.includes(JSON.stringify(selector)),`missing ${selector}`);
  }
  assert.match(source,/addEventListener\("input"/);
  assert.match(source,/addEventListener\("change"/);
});

test("settings renderer is wrapped rather than replaced with a parallel page",()=>{
  assert.match(source,/const oldRenderSettings=root\.renderSettings/);
  assert.match(source,/oldRenderSettings\.apply/);
  assert.match(source,/bind\(document\)/);
});
