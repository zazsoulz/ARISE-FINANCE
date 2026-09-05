"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const vm=require("node:vm");

const source=fs.readFileSync(path.join(__dirname,"..","sync-action-ui.js"),"utf8");

function boot({kind="online",withSync=true,withAuth=true}={}){
  const messages=[];
  let authOpened=0;
  const listeners={};
  const root={
    console,
    toast(message){messages.push(message);},
    renderAuth:withAuth?()=>{authOpened+=1;}:undefined,
    ARISE_SYNC:withSync?{pushAll:async()=>true}:undefined,
    ARISE_PRODUCT_UI:{syncState:()=>({kind})},
    addEventListener(type,handler,capture){listeners[type]={handler,capture};}
  };
  root.globalThis=root;
  root.window=root;
  vm.runInNewContext(source,root,{filename:"sync-action-ui.js"});
  return {root,messages,listeners,get authOpened(){return authOpened;}};
}

test("signed-out sync action opens authentication instead of ending in a toast-only dead end",()=>{
  const app=boot({kind:"local"});
  const outcome=app.root.ARISE_SYNC_ACTION_UI.handleSyncAction();
  assert.equal(outcome.handled,true);
  assert.equal(outcome.result,true);
  assert.equal(app.authOpened,1);
  assert.deepEqual(app.messages,[]);
});

test("missing sync runtime produces a human-readable local-safe status",()=>{
  const app=boot({kind:"online",withSync:false});
  const outcome=app.root.ARISE_SYNC_ACTION_UI.handleSyncAction();
  assert.equal(outcome.handled,true);
  assert.equal(outcome.result,false);
  assert.equal(app.messages.length,1);
  assert.match(app.messages[0],/Локальные изменения сохранены/);
});

test("normal online sync remains owned by canonical product-ui retry handler",()=>{
  const app=boot({kind:"online",withSync:true});
  const outcome=app.root.ARISE_SYNC_ACTION_UI.handleSyncAction();
  assert.equal(outcome.handled,false);
  assert.equal(outcome.result,false);
});

test("capture listener suppresses the older click handler only for handled dead-end states",()=>{
  const app=boot({kind:"local"});
  assert.equal(app.listeners.click.capture,true);
  let prevented=0;
  let stopped=0;
  const button={closest:selector=>selector===".product-sync"?button:null};
  app.listeners.click.handler({
    target:button,
    preventDefault(){prevented+=1;},
    stopImmediatePropagation(){stopped+=1;}
  });
  assert.equal(prevented,1);
  assert.equal(stopped,1);
  assert.equal(app.authOpened,1);
});
