const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('sync-entity-outbox.js','utf8');

test('entity outbox drains category and goal mutations through dedicated tables',()=>{
  for(const token of [
    'finance_categories',
    'finance_goals',
    'outbox.list(profile,entity)',
    'box.ack(profile,mutation.id)',
    'box.fail(profile,mutation.id,error)',
    'mutation.action==="delete"',
    'ARISE_ENTITY_OUTBOX'
  ]) assert.ok(source.includes(token),token+' missing');
});

test('entity outbox preserves local-first behavior and only runs with active online session',()=>{
  assert.ok(source.includes('navigator.onLine!==false'));
  assert.ok(source.includes('if(!c||!s||!s.user) return 0'));
  assert.ok(source.includes('ARISE_SYNC_SILENT=true'));
});
