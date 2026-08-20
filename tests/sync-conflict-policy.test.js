const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('sync-conflict-policy.js','utf8');
const context={globalThis:{}};
vm.createContext(context);
vm.runInContext(source,context);
const policy=context.globalThis.ARISE_SYNC_CONFLICTS;

test('dirty local plus remote change since sync becomes an explicit conflict',()=>{
  const localMeta={dirty:true,changedAt:'2026-08-20T10:00:00Z',syncedAt:'2026-08-20T09:00:00Z'};
  const result=policy.resolve({localMeta,remoteUpdatedAt:'2026-08-20T11:00:00Z'});
  assert.equal(result.winner,'conflict');
  assert.equal(result.reason,'concurrent_remote_change');
  assert.equal(localMeta.conflict.reason,'concurrent_remote_change');
  assert.equal(localMeta.conflict.baseSyncedAt,'2026-08-20T09:00:00Z');
  assert.equal(localMeta.conflict.remoteUpdatedAt,'2026-08-20T11:00:00Z');
});

test('dirty local remains safe to push when remote did not change after baseline',()=>{
  const localMeta={dirty:true,changedAt:'2026-08-20T10:00:00Z',syncedAt:'2026-08-20T09:00:00Z'};
  const result=policy.resolve({localMeta,remoteUpdatedAt:'2026-08-20T09:00:00Z'});
  assert.equal(result.winner,'local');
  assert.equal(result.reason,'local_dirty');
  assert.equal(localMeta.conflict,undefined);
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

test('clean resolution clears an old conflict marker',()=>{
  const localMeta={dirty:false,syncedAt:'2026-08-20T11:00:00Z',conflict:{reason:'concurrent_remote_change'}};
  const result=policy.resolve({localMeta,remoteUpdatedAt:'2026-08-20T11:00:00Z'});
  assert.equal(result.winner,'local');
  assert.equal(localMeta.conflict,undefined);
});
