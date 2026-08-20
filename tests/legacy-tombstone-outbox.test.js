const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function load(){
  const context={console,navigator:{onLine:true},setTimeout,clearTimeout};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('sync-outbox.js','utf8'),context);
  vm.runInContext(fs.readFileSync('sync-engine.js','utf8'),context);
  return context;
}

test('legacy tombstones become unified delete mutations',()=>{
  const context=load();
  const profile={ariseSync:{deletedCategoryIds:['remote-cat-1','remote-cat-1'],deletedGoalIds:['remote-goal-1'],outbox:[]},categories:[],goals:[],transactions:[]};
  assert.equal(context.ARISE_SYNC.applyCategoryTombstones(profile),1);
  assert.equal(context.ARISE_SYNC.applyGoalTombstones(profile),1);
  assert.equal(profile.ariseSync.deletedCategoryIds,undefined);
  assert.equal(profile.ariseSync.deletedGoalIds,undefined);
  const categories=context.ARISE_SYNC_OUTBOX.list(profile,'category');
  const goals=context.ARISE_SYNC_OUTBOX.list(profile,'goal');
  assert.equal(categories.length,1);
  assert.equal(categories[0].action,'delete');
  assert.equal(categories[0].entityRemoteId,'remote-cat-1');
  assert.equal(goals.length,1);
  assert.equal(goals[0].action,'delete');
  assert.equal(goals[0].entityRemoteId,'remote-goal-1');
});

test('repeated migration does not duplicate queued delete',()=>{
  const context=load();
  const profile={ariseSync:{deletedCategoryIds:['remote-cat-1'],outbox:[]},categories:[],goals:[],transactions:[]};
  assert.equal(context.ARISE_SYNC.applyCategoryTombstones(profile),1);
  profile.ariseSync.deletedCategoryIds=['remote-cat-1'];
  assert.equal(context.ARISE_SYNC.applyCategoryTombstones(profile),0);
  assert.equal(context.ARISE_SYNC_OUTBOX.list(profile,'category').length,1);
  assert.equal(profile.ariseSync.deletedCategoryIds,undefined);
});

test('direct compatibility delete helper is removed',()=>{
  const source=fs.readFileSync('sync-engine.js','utf8');
  assert.equal(source.includes('async function applyEntityTombstones'),false);
  assert.equal(source.includes('migrateEntityTombstones'),true);
});
