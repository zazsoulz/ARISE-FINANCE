const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const product=fs.readFileSync('product-ui.js','utf8');
const v3=fs.readFileSync('arise-v3.js','utf8');
const analytics=fs.readFileSync('analytics-ui.js','utf8');
const css=fs.readFileSync('product-ui.css','utf8');

test('active primary navigation exposes aria-current',()=>{
  assert.match(product,/aria-current="page"/);
});

test('history and analytics chart interaction zones stay keyboard reachable',()=>{
  assert.match(v3,/class="v3-chart-hit" tabindex="0" role="button"/);
  assert.match(analytics,/class="analytics-chart-hit" tabindex="0" role="button"/);
  assert.match(v3,/addEventListener\("focus"/);
  assert.match(analytics,/addEventListener\("focus"/);
});

test('chart live readouts remain announced without making the SVG itself stateful',()=>{
  assert.match(v3,/class="v3-chart-current" aria-live="polite"/);
  assert.match(analytics,/class="analytics-chart-readout" aria-live="polite"/);
});

test('visual interaction layer retains reduced-motion coverage',()=>{
  assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css,/\.v3-chart-point/);
  assert.match(css,/\.analytics-pulse circle/);
});
