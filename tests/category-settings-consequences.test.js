const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

function control(value="",checked=false){return {value:String(value),checked,closest(){return {style:{}};},addEventListener(){}};}
function editor({type="percentage",percent=10,fixed=0,priority=3,limit="",enabled=true}={}){
  const controls={
    ".category-type":control(type),
    ".category-percent":control(percent),
    ".category-fixed":control(fixed),
    ".category-priority":control(priority),
    ".category-limit":control(limit),
    ".category-enabled":control("",enabled)
  };
  return {querySelector(selector){return controls[selector]||null;}};
}
function load(){
  const context={
    console,Intl,
    document:{querySelectorAll(){return [];},createElement(){return {};}}
  };
  context.globalThis=context;
  context.window=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("category-settings-consequences.js","utf8"),context);
  return context;
}

test("percentage rule explains per-income behavior, cap and high priority",()=>{
  const api=load().ARISE_CATEGORY_SETTINGS_CONSEQUENCES;
  const info=api.describe(editor({percent:15,priority:5,limit:30000}));
  assert.match(info.text,/15% с каждого нового дохода/);
  assert.match(info.text,/30 000/);
  assert.match(info.text,/Высокий приоритет/);
});

test("fixed rule explains monthly amount without percentage semantics",()=>{
  const api=load().ARISE_CATEGORY_SETTINGS_CONSEQUENCES;
  const info=api.describe(editor({type:"fixed",fixed:12000,priority:2}));
  assert.match(info.text,/12 000/);
  assert.doesNotMatch(info.text,/с каждого нового дохода/);
  assert.match(info.text,/Низкий приоритет/);
});

test("disabled rule says existing operations are untouched",()=>{
  const api=load().ARISE_CATEGORY_SETTINGS_CONSEQUENCES;
  const info=api.describe(editor({enabled:false}));
  assert.match(info.title,/Не участвует/);
  assert.match(info.text,/Уже сохранённые операции не меняются/);
});

test("remainder rule is described as residual rather than automatic percent",()=>{
  const api=load().ARISE_CATEGORY_SETTINGS_CONSEQUENCES;
  const info=api.describe(editor({type:"remainder",priority:3}));
  assert.match(info.text,/получает только остаток/);
  assert.doesNotMatch(info.text,/10% с каждого нового дохода/);
});
