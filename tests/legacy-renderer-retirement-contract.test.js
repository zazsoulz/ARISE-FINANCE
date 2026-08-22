const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');

const EXPECTED=[
  'renderNav',
  'renderHome',
  'renderIncome',
  'renderGoals',
  'renderHistory',
  'renderAnalytics',
  'renderSettings'
];

test('remaining legacy screen renderer retirement is owned by one registry',()=>{
  assert.match(index,/const LEGACY_RENDERER_RETIREMENT=\[/);
  assert.match(index,/html=retireLegacyRenderers\(html\);/);

  const registry=index.match(/const LEGACY_RENDERER_RETIREMENT=\[([\s\S]*?)\n  \];/);
  assert.ok(registry,'legacy renderer retirement registry missing');

  const names=[...registry[1].matchAll(/\["(render[A-Za-z]+)"/g)].map(match=>match[1]);
  assert.deepEqual(names,EXPECTED);

  for(const name of EXPECTED){
    const direct=new RegExp(`html=retireLegacyRenderer\\(html,"${name}"`);
    assert.equal(direct.test(index),false,`${name} must retire through the central registry`);
  }
});

test('retirement stays fail-closed on missing shell boundaries',()=>{
  assert.match(index,/ARISE shell renderer boundary not found/);
  assert.match(index,/ARISE shell renderer end boundary not found/);
  assert.match(index,/LEGACY_RENDERER_RETIREMENT\.reduce/);
});

test('physically retired topbar stays out of compatibility source and registry',()=>{
  assert.doesNotMatch(shell,/function\s+renderTopbar\s*\(/);
  assert.equal(index.includes('[\"renderTopbar\"'),false);
});
