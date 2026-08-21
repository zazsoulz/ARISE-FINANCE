const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function boot(){
  const dom=new JSDOM('<!doctype html><button id="open">Открыть</button><div id="modal" class="modal"><div id="sheet" class="sheet"></div></div>',{pretendToBeVisual:true});
  const document=dom.window.document;
  const context={console,document,window:null,globalThis:null};
  context.openModal=html=>{document.getElementById('sheet').innerHTML=html;document.getElementById('modal').classList.add('open');};
  context.closeModal=()=>{document.getElementById('modal').classList.remove('open');};
  context.window=context;context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('modal-accessibility.js','utf8'),context,{filename:'modal-accessibility.js'});
  return {context,dom,document};
}

test('modal receives dialog semantics and moves focus inside then back to opener',()=>{
  const {context,dom,document}=boot();
  const opener=document.getElementById('open');opener.focus();
  context.openModal('<h2 class="title">Доход</h2><input id="amount"><button id="save">Сохранить</button>');
  const modal=document.getElementById('modal');
  assert.equal(modal.getAttribute('role'),'dialog');
  assert.equal(modal.getAttribute('aria-modal'),'true');
  assert.ok(modal.getAttribute('aria-labelledby'));
  assert.equal(document.activeElement.id,'amount');
  context.closeModal();
  assert.equal(document.activeElement.id,'open');
  dom.window.close();
});

test('tab navigation stays inside an open modal',()=>{
  const {context,dom,document}=boot();
  context.openModal('<h2 class="title">Расход</h2><input id="first"><button id="last">Сохранить</button>');
  const first=document.getElementById('first'),last=document.getElementById('last');
  last.focus();
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  assert.equal(document.activeElement.id,'first');
  first.focus();
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
  assert.equal(document.activeElement.id,'last');
  dom.window.close();
});

test('Escape closes an open modal and restores focus to its opener',()=>{
  const {context,dom,document}=boot();
  const opener=document.getElementById('open');
  opener.focus();
  context.openModal('<h2 class="title">Цель</h2><button id="inside">Готово</button>');
  assert.equal(document.getElementById('modal').classList.contains('open'),true);
  assert.equal(document.activeElement.id,'inside');
  const event=new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});
  document.dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);
  assert.equal(document.getElementById('modal').classList.contains('open'),false);
  assert.equal(document.activeElement.id,'open');
  dom.window.close();
});

test('Escape is ignored when no modal is open',()=>{
  const {dom,document}=boot();
  const event=new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});
  document.dispatchEvent(event);
  assert.equal(event.defaultPrevented,false);
  assert.equal(document.getElementById('modal').classList.contains('open'),false);
  dom.window.close();
});
