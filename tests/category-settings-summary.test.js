const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("enabled category explanation always includes cap and priority context",()=>{
  const cap=source.indexOf("const cap=");
  const priority=source.indexOf("const priorityText=");
  const result=source.indexOf('return {tone:"normal"');
  assert.ok(cap>=0 && priority>cap && result>priority);
  assert.match(source.slice(result,result+180),/rule\+cap\+priorityText/);
});
