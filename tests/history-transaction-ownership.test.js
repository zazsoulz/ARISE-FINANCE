const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('history-inspector.js','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');

function boot(){
  const context=vm.createContext({
    globalThis:null,
    renderHistory(){},
    activeProfile(){return {settings:{currency:'RUB'},transactions:[],categories:[],goals:[]};},
    escapeHTML(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');},
    money(value,currency='RUB'){return `${Number(value)||0} ${currency}`;},
    formatDate(value){return String(value||'');},
    openModal(){},closeModal(){},document:{querySelector(){return null;},getElementById(){return null;}},
    activeMonth:'2026-08'
  });
  context.globalThis=context;
  new vm.Script(source,{filename:'history-inspector.js'}).runInContext(context);
  return context;
}

test('history inspector is the canonical runtime owner of history transaction rows',()=>{
  assert.match(source,/function historyTransaction\(tx\)/);
  assert.match(source,/root\.historyTransaction=historyTransaction/);
  assert.match(source,/ARISE_HISTORY_INSPECTOR=\{[^}]*historyTransaction/);
  const v3=index.indexOf('./arise-v3.js');
  const inspector=index.indexOf('./history-inspector.js');
  const bootstrap=index.indexOf('./financial-bootstrap.js');
  assert.ok(v3>=0&&inspector>v3&&bootstrap>inspector,'history row owner must load after canonical History renderer and before bootstrap');
});

test('canonical history row renderer preserves income allocation and reserve details',()=>{
  const context=boot();
  const html=context.historyTransaction({
    type:'income',amount:1000,currency:'RUB',source:'Работа',date:'2026-08-24',reserve:100,
    allocations:[{name:'На жизнь',amount:500}]
  });
  assert.match(html,/Доход/);
  assert.match(html,/Работа/);
  assert.match(html,/На жизнь/);
  assert.match(html,/500 RUB/);
  assert.match(html,/РЕЗЕРВ/);
  assert.match(html,/100 RUB/);
});

test('canonical history row renderer preserves expense semantics and escapes labels',()=>{
  const context=boot();
  const html=context.historyTransaction({type:'expense',amount:300,currency:'RUB',categoryName:'Еда <дом>',source:'Карта',date:'2026-08-24'});
  assert.match(html,/Расход/);
  assert.match(html,/- 300 RUB/);
  assert.match(html,/Еда &lt;дом&gt;/);
  assert.doesNotMatch(html,/Еда <дом>/);
});

test('legacy shell copy remains only as the next physical-cleanup target',()=>{
  assert.match(shell,/function historyTransaction\(tx\)/);
  assert.match(source,/root\.historyTransaction=historyTransaction/);
});
