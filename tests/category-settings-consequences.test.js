const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function control(value='',checked=false){return {value:String(value),checked,closest(){return {style:{}};},addEventListener(){}};}
function editor({type='percentage',percent=10,fixed=0,priority=3,limit='',enabled=true}={}){
  const controls={
    '.category-type':control(type),
    '.category-percent':control(percent),
    '.category-fixed':control(fixed),
    '.category-priority':control(priority),
    '.category-limit':control(limit),
    '.category-enabled':control('',enabled)
  };
  return {querySelector(selector){return controls[selector]||null;}};
}
function load(){
  const context={console,Intl,document:{querySelectorAll(){return [];},createElement(){return {};}}};
  context.globalThis=context; context.window=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('category-settings-consequences.js','utf8'),context);
  return context.ARISE_CATEGORY_SETTINGS_CONSEQUENCES;
}

test('percentage rule explains per-income behavior, monthly limit and priority',()=>{
  const info=load().describe(editor({percent:15,priority:5,limit:30000}));
  assert.match(info.text,/15%.*каждого нового дохода/);
  assert.match(info.text,/30\s?000|30 000/);
  assert.match(info.text,/Высокий приоритет/);
});

test('fixed rule is monthly and does not claim per-income percentage behavior',()=>{
  const info=load().describe(editor({type:'fixed',fixed:12000,priority:2}));
  assert.match(info.text,/12\s?000|12 000/);
  assert.match(info.text,/в месяц/);
  assert.doesNotMatch(info.text,/с каждого нового дохода/);
  assert.match(info.text,/Низкий приоритет/);
});

test('disabled category explicitly preserves existing history',()=>{
  const info=load().describe(editor({enabled:false}));
  assert.equal(info.warning,true);
  assert.match(info.text,/Уже сохранённые операции не меняются/);
});

test('module is loaded after the final distribution UI layer',()=>{
  const index=fs.readFileSync('index.html','utf8');
  assert.ok(index.indexOf('./category-settings-consequences.js')>index.indexOf('./arise-v3.js'));
});
