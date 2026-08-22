const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');

const retiredRuntime=[
  'arise-v3-state.css',
  'analytics-chart-accessibility.css',
  'analytics-expense-ui.js',
  'canonical-ui-overrides.js',
  'goal-history-ui.js',
  'reserve-history-drilldown.js',
  'currency-freshness-ui.js',
  'screen-state-ui.js',
  'modal-accessibility.js'
];

const canonicalStyles=[
  './arise-v3.css',
  './analytics-ui.css',
  './product-ui.css'
];

test('retired transition-era UI layers stay out of the production loader and repository',()=>{
  for(const file of retiredRuntime){
    assert.equal(index.includes(file),false,`${file} returned to the production loader`);
    assert.equal(fs.existsSync(file),false,`${file} returned to the repository`);
  }
});

test('production loader keeps the consolidated three-style surface',()=>{
  const styles=[...index.matchAll(/href=\\?"(\.\/[^"\\]+\.css)\\?"/g)].map(match=>match[1]);
  for(const style of canonicalStyles){
    assert.equal(styles.includes(style),true,`${style} missing from production loader`);
  }
  assert.deepEqual(styles.filter(style=>style.startsWith('./')),canonicalStyles);
});
