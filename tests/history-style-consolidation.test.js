const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const productCss=fs.readFileSync('product-ui.css','utf8');

test('history inspector styles live in the canonical product stylesheet',()=>{
  assert.equal(index.includes('./history-inspector.css'),false,'runtime manifest must not load the retired history stylesheet');
  assert.equal(fs.existsSync('history-inspector.css'),false,'retired history stylesheet must stay removed');
  assert.equal(productCss.includes('.history-filter-panel{'),true,'history filter panel styling must remain available');
  assert.equal(productCss.includes('.history-inspect-row:focus-visible'),true,'history keyboard focus styling must remain available');
  assert.equal(productCss.includes('.history-detail-row{'),true,'history detail styling must remain available');
});
