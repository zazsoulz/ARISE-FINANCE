const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("category-settings-consequences.js","utf8");

test("category consequence module exposes only its focused public helpers",()=>{
  assert.match(source,/ARISE_CATEGORY_SETTINGS_CONSEQUENCES=\{describe,bind\}/);
});
