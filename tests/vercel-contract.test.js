const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const index=fs.readFileSync('index.html','utf8');

test('Vercel deployment is canonical static root with no framework build pipeline',()=>{
  assert.equal(config.framework,null);
  assert.equal('buildCommand' in config,false);
  assert.equal('outputDirectory' in config,false);
  assert.equal('builds' in config,false);
  assert.equal('functions' in config,false);
  assert.equal('rewrites' in config,false);
  assert.equal('redirects' in config,false);
});

test('production entry files exist at repository root',()=>{
  assert.equal(fs.existsSync('index.html'),true);
  assert.equal(fs.existsSync('app-shell.html'),true);
  assert.match(index,/fetch\("\.\/app-shell\.html"/);
});

test('bootstrap documents are never permanently cached',()=>{
  const bySource=new Map((config.headers||[]).map(item=>[item.source,item.headers||[]]));
  for(const source of ['/index.html','/app-shell.html']){
    const headers=bySource.get(source)||[];
    const cache=headers.find(item=>String(item.key).toLowerCase()==='cache-control');
    assert.ok(cache,source+' cache policy missing');
    assert.match(String(cache.value),/no-store/i);
  }
});
