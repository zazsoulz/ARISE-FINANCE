const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('sync-engine.js','utf8');

test('sync engine seeds and drains unified outbox instead of full transaction push loop',()=>{
  for(const token of [
    'seedEntityOutbox(profile,"category","categories")',
    'seedEntityOutbox(profile,"goal","goals")',
    'ARISE_ENTITY_OUTBOX.drainProfile(profile,user.id)',
    'seedTransactionOutbox(profile)',
    'flushTransactionOutbox(profile,profileId,user)'
  ]) assert.ok(source.includes(token),token+' missing');

  assert.equal(source.includes('for(const tx of profile.transactions||[]){await syncTransaction'),false);
});

test('legacy category and goal tombstones are migration-only cleanup before unified outbox drain',()=>{
  assert.ok(source.includes('const legacyCategoryDeletes=await applyCategoryTombstones'));
  assert.ok(source.includes('const legacyGoalDeletes=await applyGoalTombstones'));
  assert.ok(source.includes('legacyDeletes:legacyCategoryDeletes+legacyGoalDeletes'));
});
