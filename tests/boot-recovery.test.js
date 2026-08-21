const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');

const index=fs.readFileSync('index.html','utf8');
const inline=index.match(/<script>\s*([\s\S]*?)<\/script>/i)?.[1];
assert.ok(inline,'inline bootstrap script missing');

async function bootFailure({offline=false}={}){
  const dom=new JSDOM('<!doctype html><div id="boot">ARISE</div>',{url:'https://arise.local/',runScripts:'outside-only'});
  const {window}=dom;
  Object.defineProperty(window.navigator,'onLine',{value:!offline,configurable:true});
  window.fetch=async()=>{throw new Error('network unavailable');};
  window.console.error=()=>{};
  window.eval(inline);
  await new Promise(resolve=>window.setTimeout(resolve,0));
  return dom;
}

test('bootstrap failure exposes a safe retry action instead of a dead error message',async()=>{
  const dom=await bootFailure();
  const document=dom.window.document;
  const boot=document.getElementById('boot');
  assert.equal(boot.getAttribute('role'),'alert');
  assert.equal(boot.dataset.error,'bootstrap');
  assert.match(boot.textContent,/не удалось загрузить/i);
  assert.match(boot.textContent,/Финансовые данные не изменены/i);
  const retry=document.getElementById('bootRetry');
  assert.ok(retry,'retry action missing');
  assert.equal(retry.type,'button');
  assert.equal(typeof retry.onclick,'function');
  dom.window.close();
});

test('offline bootstrap failure explains that local financial data remains saved',async()=>{
  const dom=await bootFailure({offline:true});
  const text=dom.window.document.getElementById('boot').textContent;
  assert.match(text,/нет подключения к сети/i);
  assert.match(text,/локальные финансовые данные остаются сохранены/i);
  assert.ok(dom.window.document.getElementById('bootRetry'));
  dom.window.close();
});
