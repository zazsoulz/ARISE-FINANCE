const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');
const ariseV3=fs.readFileSync('arise-v3.js','utf8');

const navMarker=`/* =========================================================\n   NAV\n========================================================= */`;
const homeMarker=`/* =========================================================\n   HOME\n========================================================= */`;

test('production loader retires legacy topbar and nav from the effective compatibility shell',()=>{
  assert.match(shell,/function\s+renderTopbar\s*\(/,'source compatibility shell should still contain topbar until physical source retirement');
  assert.match(shell,/function\s+renderNav\s*\(/,'source compatibility shell should still contain nav until physical source retirement');
  assert.match(index,/function\s+retireLegacyRenderer\s*\(/,'loader retirement helper missing');
  assert.equal(index.includes('retireLegacyRenderer(html,"renderTopbar",`/* =========================================================\\n   NAV\\n========================================================= */`)'),true,'renderTopbar is not retired before canonical runtime boot');
  assert.equal(index.includes('retireLegacyRenderer(html,"renderNav",`/* =========================================================\\n   HOME\\n========================================================= */`)'),true,'renderNav is not retired before canonical runtime boot');
  assert.match(ariseV3,/root\.renderTopbar\s*=\s*function\s*\(/,'canonical topbar owner missing');
  assert.match(ariseV3,/root\.renderNav\s*=\s*function\s*\(/,'canonical nav owner missing');
});

test('renderer retirement helper fails closed when a compatibility boundary drifts',()=>{
  assert.match(index,/renderer boundary not found/);
  assert.match(index,/renderer end boundary not found/);
  const topbarStart=shell.indexOf('function renderTopbar(){');
  const followingNav=shell.indexOf(navMarker,topbarStart);
  assert.ok(topbarStart>=0,'legacy topbar missing before source retirement');
  assert.ok(followingNav>topbarStart,'topbar/nav boundary order drifted');
  const navStart=shell.indexOf('function renderNav(){');
  const followingHome=shell.indexOf(homeMarker,navStart);
  assert.ok(navStart>=0,'legacy nav missing before source retirement');
  assert.ok(followingHome>navStart,'nav/home boundary order drifted');
});

test('topbar and nav are retired while home remains staged for the next shell pass',()=>{
  assert.equal((index.match(/retireLegacyRenderer\(html,/g)||[]).length,2);
  assert.match(shell,/function\s+renderHome\s*\(/);
  assert.equal(index.includes('retireLegacyRenderer(html,"renderHome"'),false,'home should remain for a separate reviewed retirement step');
});
