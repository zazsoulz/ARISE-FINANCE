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

test('legacy category and goal tombstones migrate into the unified outbox before entity drain',()=>{
  assert.ok(source.includes('const legacyCategoryDeletes=applyCategoryTombstones(profile)'));
  assert.ok(source.includes('const legacyGoalDeletes=applyGoalTombstones(profile)'));
  assert.ok(source.includes('migrateEntityTombstones'));
  assert.match(source,/outbox\.enqueue\(profile,\{entity,entityLocalId:null,entityRemoteId:[a-zA-Z_$][\w$]*,action:"delete"\}\)/);
  assert.equal(source.includes('c.from(table).delete()'),false);
  assert.equal(source.includes('legacyMigrated:'),false);
  assert.ok(source.includes('legacyDeletes:legacyCategoryDeletes+legacyGoalDeletes'));
});
