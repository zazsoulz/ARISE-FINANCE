const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const path='supabase/migrations/20260820075500_canonical_performance_hardening.sql';
const sql=fs.readFileSync(path,'utf8');

const canonicalTables=[
  'accounts','finance_profiles','finance_categories','finance_goals',
  'finance_transactions','finance_allocations','sync_receipts'
];

const expectedIndexes=[
  'finance_transactions_category_id_idx',
  'finance_transactions_goal_id_idx',
  'finance_allocations_category_id_idx',
  'finance_allocations_goal_id_idx',
  'finance_allocations_user_id_idx',
  'sync_receipts_profile_id_idx'
];

test('canonical performance migration adds only missing FK covering indexes',()=>{
  for(const name of expectedIndexes){
    assert.match(sql,new RegExp(`create index if not exists ${name}\\b`,'i'),name+' missing');
  }
  assert.equal((sql.match(/create index if not exists/gi)||[]).length,expectedIndexes.length);
});

test('canonical RLS policies keep authenticated ownership semantics with init-plan auth uid',()=>{
  for(const table of canonicalTables){
    assert.match(sql,new RegExp(`on public\\.${table}\\b`,'i'),table+' policy missing');
  }
  assert.equal(/user_id\s*=\s*auth\.uid\s*\(\s*\)/i.test(sql),false,'direct auth.uid() should not remain in optimized policies');
  assert.match(sql,/user_id\s*=\s*\(\s*select\s+auth\.uid\s*\(\s*\)\s*\)/i);
});

test('migration does not alter or drop canonical tables or weaken RLS',()=>{
  assert.equal(/drop\s+table/i.test(sql),false);
  assert.equal(/alter\s+table[\s\S]*disable\s+row\s+level\s+security/i.test(sql),false);
  assert.equal(/to\s+anon\b/i.test(sql),false);
});
