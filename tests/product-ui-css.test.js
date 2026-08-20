const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const shell=fs.readFileSync('app-shell.html','utf8');
const css=fs.readFileSync('product-ui.css','utf8');

test('product modal polish targets the real shell modal and sheet selectors',()=>{
  assert.ok(shell.includes('.modal.open'));
  assert.ok(shell.includes('.sheet{'));
  assert.ok(css.includes('.modal{backdrop-filter:blur(16px)'));
  assert.ok(css.includes('.sheet{border-color:var(--product-border)'));
  assert.equal(css.includes('.modal-overlay'),false);
  assert.equal(css.includes('.modal-card'),false);
});

test('mobile modal uses dynamic viewport and safe-area aware bounds',()=>{
  assert.ok(css.includes('100dvh'));
  assert.ok(css.includes('env(safe-area-inset-top)'));
  assert.ok(css.includes('env(safe-area-inset-bottom)'));
  assert.ok(css.includes('overscroll-behavior:contain'));
});

test('syncing state has motion feedback and respects reduced-motion preference',()=>{
  assert.ok(css.includes('.product-sync.syncing i'));
  assert.ok(css.includes('@keyframes productSyncPulse'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(css.includes('animation-duration:.01ms!important'));
});
