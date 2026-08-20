const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function load(path,context){
  new vm.Script(fs.readFileSync(path,'utf8'),{filename:path}).runInContext(context);
}

function boot(){
  const context=vm.createContext({
    console,
    globalThis:null,
    window:null,
    navigator:{onLine:true},
    setTimeout,
    clearTimeout
  });
  context.globalThis=context;
  context.window=context;
  load('sync-conflict-policy.js',context);
  load('sync-pull.js',context);
  return context;
}

test('sync pull delegates remote/local choice to canonical conflict policy',()=>{
  const ctx=boot();
  const local={ariseSync:{dirty:false,syncedAt:'2026-08-20T00:00:00.000Z'}};
  assert.equal(ctx.ARISE_SYNC_PULL.shouldUseRemote('2026-08-20T00:00:01.000Z',local),true);
  assert.equal(ctx.ARISE_SYNC_PULL.shouldUseRemote('2026-08-19T23:59:59.000Z',local),false);
});

test('dirty local entity always wins a pull conflict',()=>{
  const ctx=boot();
  const local={ariseSync:{dirty:true,changedAt:'2026-08-19T23:00:00.000Z',syncedAt:'2026-08-19T22:00:00.000Z'}};
  assert.equal(ctx.ARISE_SYNC_PULL.shouldUseRemote('2026-08-20T02:00:00.000Z',local),false);
});

test('remote wins when a clean local entity has no prior sync timestamp',()=>{
  const ctx=boot();
  const local={ariseSync:{dirty:false}};
  assert.equal(ctx.ARISE_SYNC_PULL.shouldUseRemote('2026-08-20T02:00:00.000Z',local),true);
});
