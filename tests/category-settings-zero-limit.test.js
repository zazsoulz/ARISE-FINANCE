const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
function load(){const context={console,Intl,document:{querySelectorAll(){return[];},createElement(){return{};}}};context.globalThis=context;context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync("category-settings-consequences.js","utf8"),context);return context.ARISE_CATEGORY_SETTINGS_CONSEQUENCES;}
function editor(){const values={".category-type":{value:"percentage"},".category-percent":{value:"10"},".category-fixed":{value:"0"},".category-priority":{value:"3"},".category-limit":{value:"0"},".category-enabled":{checked:true}};return{querySelector:s=>values[s]||null};}
test("explicit zero limit is treated as a cap, not as no limit",()=>{const info=load().describe(editor());assert.match(info.text,/После 0 ₽ за месяц/);assert.doesNotMatch(info.text,/Месячного лимита нет/);});
