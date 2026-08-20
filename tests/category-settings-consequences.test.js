const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {JSDOM}=require("jsdom");

function load(){
  const dom=new JSDOM("<!doctype html><body></body>");
  const context={window:dom.window,document:dom.window.document,globalThis:null,Intl,console};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("category-settings-consequences.js","utf8"),context);
  return context;
}

function editor(context,{type="percentage",percent=10,fixed=0,priority=3,limit="",enabled=true}={}){
  const node=context.document.createElement("div");
  node.dataset.categoryEditor="cat";
  node.innerHTML=`
    <div class="field"><select class="category-type"><option value="fixed" ${type==="fixed"?"selected":""}>fixed</option><option value="percentage" ${type==="percentage"?"selected":""}>percentage</option><option value="remainder" ${type==="remainder"?"selected":""}>remainder</option></select></div>
    <div class="field"><input class="category-percent" value="${percent}"></div>
    <div class="field"><input class="category-fixed" value="${fixed}"></div>
    <div class="field"><input class="category-priority" value="${priority}"></div>
    <div class="field"><input class="category-limit" value="${limit}"></div>
    <label class="check"><input class="category-enabled" type="checkbox" ${enabled?"checked":""}></label>`;
  return node;
}

test("percentage rule explains per-income behavior and monthly cap",()=>{
  const context=load();
  const info=context.ARISE_CATEGORY_SETTINGS_CONSEQUENCES.describe(editor(context,{percent:15,priority:5,limit:30000}));
  assert.match(info.text,/15% с каждого нового дохода/);
  assert.match(info.text,/30 000/);
  assert.match(info.text,/Высокий приоритет/);
});

test("fixed rule does not describe percentage allocation",()=>{
  const context=load();
  const info=context.ARISE_CATEGORY_SETTINGS_CONSEQUENCES.describe(editor(context,{type:"fixed",fixed:12000,priority:2}));
  assert.match(info.text,/12 000/);
  assert.doesNotMatch(info.text,/с каждого нового дохода/);
  assert.match(info.text,/Низкий приоритет/);
});

test("disabled category explicitly states that existing operations stay intact",()=>{
  const context=load();
  const info=context.ARISE_CATEGORY_SETTINGS_CONSEQUENCES.describe(editor(context,{enabled:false}));
  assert.match(info.title,/Не участвует/);
  assert.match(info.text,/Уже сохранённые операции не меняются/);
});

test("binding hides irrelevant amount control when type changes",()=>{
  const context=load();
  const node=editor(context,{type:"fixed",fixed:5000});
  context.document.body.appendChild(node);
  context.ARISE_CATEGORY_SETTINGS_CONSEQUENCES.bind(context.document);
  assert.equal(node.querySelector(".category-percent").closest(".field").style.display,"none");
  assert.equal(node.querySelector(".category-fixed").closest(".field").style.display,"");
  node.querySelector(".category-type").value="percentage";
  node.querySelector(".category-type").dispatchEvent(new context.window.Event("change"));
  assert.equal(node.querySelector(".category-percent").closest(".field").style.display,"");
  assert.equal(node.querySelector(".category-fixed").closest(".field").style.display,"none");
});
