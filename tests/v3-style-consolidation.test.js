const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const productCss=fs.readFileSync('product-ui.css','utf8');

test('A1-V3 state styles live in the canonical product stylesheet',()=>{
  assert.equal(index.includes('./arise-v3-state.css'),false,'runtime manifest must not load the retired state override stylesheet');
  assert.equal(fs.existsSync('arise-v3-state.css'),false,'retired state override stylesheet must stay removed');
  assert.equal(productCss.includes('.v3-alert{'),true,'V3 alert styling must remain available after consolidation');
  assert.equal(productCss.includes('.v3-goal-main small.v3-warning'),true,'V3 warning styling must remain available after consolidation');
});
