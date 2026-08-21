const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('production uses the canonical Supabase public config only',()=>{
  const index=fs.readFileSync('index.html','utf8');
  assert.equal(fs.existsSync('supabase-config.js'),false,'legacy supabase-config.js must stay retired');
  assert.equal(fs.existsSync('supabase-public-config.js'),true);
  assert.equal(index.includes('./supabase-public-config.js'),true);
  assert.equal(index.includes('./supabase-config.js'),false);
  const config=fs.readFileSync('supabase-public-config.js','utf8');
  assert.match(config,/ARISE_SUPABASE_CONFIG/);
  assert.match(config,/publishableKey/);
});
