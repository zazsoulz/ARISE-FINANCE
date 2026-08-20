const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const migration='supabase/migrations/20260820045000_phase3_currency_snapshot.sql';
const edge='supabase/functions/fx-rates/index.ts';

test('FX backend source is versioned in canonical Supabase paths',()=>{
  assert.equal(fs.existsSync(migration),true);
  assert.equal(fs.existsSync(edge),true);
  const sql=fs.readFileSync(migration,'utf8');
  for(const token of ['base_currency','exchange_rate_to_base','base_amount','fx_source','fx_fetched_at']) assert.ok(sql.includes(token));
  const fn=fs.readFileSync(edge,'utf8');
  assert.ok(fn.includes('open.er-api.com/v6/latest/USD'));
  assert.ok(fn.includes('ALLOWED = ["USD", "EUR", "RUB"]'));
});
