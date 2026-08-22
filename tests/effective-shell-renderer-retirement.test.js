const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');
const ariseV3=fs.readFileSync('arise-v3.js','utf8');

const navMarker=`/* =========================================================\n   NAV\n========================================================= */`;

test('production loader retires legacy topbar from the effective compatibility shell',()=>{
  assert.match(shell,/function\s+renderTopbar\s*\(/,'source compatibility shell should still contain topbar until physical source retirement');
  assert.match(index,/function\s+retireLegacyRenderer\s*\(/,'loader retirement helper missing');
  assert.equal(index.includes('retireLegacyRenderer(html,"renderTopbar",`/* =========================================================\\n   NAV\\n========================================================= */`)'),true,'renderTopbar is not retired before canonical runtime boot');
  assert.match(ariseV3,/root\.renderTopbar\s*=\s*function\s*\(/,'canonical topbar owner missing');
});

test('renderer retirement helper fails closed when a compatibility boundary drifts',()=>{
  assert.match(index,/renderer boundary not found/);
  assert.match(index,/renderer end boundary not found/);
  const topbarStart=shell.indexOf('function renderTopbar(){');
  const followingNav=shell.indexOf(navMarker,topbarStart);
  assert.ok(topbarStart>=0,'legacy topbar missing before source retirement');
  assert.ok(followingNav>topbarStart,'topbar/nav boundary order drifted');
});

test('only topbar is retired in the first staged shell pass',()=>{
  assert.equal((index.match(/retireLegacyRenderer\(html,/g)||[]).length,1);
  assert.match(shell,/function\s+renderNav\s*\(/);
  assert.match(shell,/function\s+renderHome\s*\(/);
});
