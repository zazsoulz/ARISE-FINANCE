const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ux=fs.readFileSync("category-settings-consequences.js","utf8");

test("category consequence layer has no reserved user category name",()=>{
  for(const name of ["Жизнь","Творчество","Семья","Свободные деньги","Обязательные расходы"]){
    assert.equal(ux.includes(name),false,`reserved ${name}`);
  }
});
