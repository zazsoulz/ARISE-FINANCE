const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const analyticsCss=fs.readFileSync('analytics-ui.css','utf8');

test('analytics chart accessibility styles live in the canonical analytics stylesheet',()=>{
  assert.equal(index.includes('./analytics-chart-accessibility.css'),false,'runtime manifest must not load the retired chart stylesheet');
  assert.equal(fs.existsSync('analytics-chart-accessibility.css'),false,'retired chart stylesheet must stay removed');
  assert.equal(analyticsCss.includes('.analytics-chart-details{'),true,'chart disclosure styling must remain available');
  assert.equal(analyticsCss.includes('.analytics-chart-table{'),true,'accessible chart table styling must remain available');
  assert.equal(analyticsCss.includes('.analytics-chart-details summary:focus-visible'),true,'keyboard focus styling must remain available');
});
