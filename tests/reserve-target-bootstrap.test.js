const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const bootstrap=fs.readFileSync('financial-bootstrap.js','utf8');

test('bootstrap normalizes reserve target compatibility after remote hydration and before render',()=>{
  const pull=bootstrap.indexOf('await globalThis.ARISE_SYNC_PULL.pullAll()');
  const normalize=bootstrap.indexOf('if(normalizeReserveTargetCompatibility())');
  const render=bootstrap.indexOf('if(state.account.registered) render()');
  assert.ok(normalize>pull,'reserve target normalization must happen after remote pull');
  assert.ok(render>normalize,'reserve target normalization must happen before first app render');
});

test('compatibility normalization persists locally without scheduling a semantic sync mutation',()=>{
  assert.match(bootstrap,/ARISE_SYNC_SILENT=true;\s*try\{saveState\(\);\}finally\{globalThis\.ARISE_SYNC_SILENT=false;\}/);
  assert.match(bootstrap,/normalizeTargetSettings\(profile\.settings\.reserve\|\|\{\}\)/);
});