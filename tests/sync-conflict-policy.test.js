const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('sync-conflict-policy.js','utf8');
const context={globalThis:{}};
vm.createContext(context);
vm.runInContext(source,context);
const policy=context.globalThis.ARISE_SYNC_CONFLICTS;

test('dirty local data always wins over remote',()=>{
  const result=policy.resolve({
    localMeta:{dirty:true,changedAt:'2026-08-20T10:00:00Z',syncedAt:'2026-08-20T09:00:00Z'},
    remoteUpdatedAt:'2026-08-20T11:00:00Z'
  });
  assert.equal(result.winner,'local');
  assert.equal(result.reason,'local_dirty');
});

test('newer remote data wins when local is clean',()=>{
  const result=policy.resolve({
    localMeta:{dirty:false,syncedAt:'2026-08-20T09:00:00Z'},
    remoteUpdatedAt:'2026-08-20T10:00:00Z'
  });
  assert.equal(result.winner,'remote');
});

test('equal or older remote data does not overwrite local',()=>{
  const result=policy.resolve({
    localMeta:{dirty:false,changedAt:'2026-08-20T10:00:00Z',syncedAt:'2026-08-20T09:00:00Z'},
    remoteUpdatedAt:'2026-08-20T10:00:00Z'
  });
  assert.equal(result.winner,'local');
});
