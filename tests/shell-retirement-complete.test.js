const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');

const retired=[
  'renderTopbar',
  'renderNav',
  'renderHome',
  'renderIncome',
  'renderGoals',
  'renderHistory',
  'renderAnalytics',
  'renderSettings'
];

test('all primary legacy screen renderers stay physically retired from app-shell',()=>{
  for(const name of retired){
    assert.equal(
      shell.includes(`function ${name}(){`),
      false,
      `${name} must not return to the compatibility shell`
    );
  }
});

test('dead primary-screen retirement loader stays removed from production bootstrap',()=>{
  assert.doesNotMatch(index,/LEGACY_RENDERER_RETIREMENT/);
  assert.doesNotMatch(index,/retireLegacyRenderer/);
  assert.doesNotMatch(index,/retireLegacyRenderers/);
  assert.doesNotMatch(index,/retireLegacyNavigationConstants/);
});

test('canonical owners for all primary screens remain in external runtime modules',()=>{
  const productUi=fs.readFileSync('product-ui.js','utf8');
  const v3=fs.readFileSync('arise-v3.js','utf8');
  const analytics=fs.readFileSync('analytics-ui.js','utf8');
  const settings=fs.readFileSync('settings-ui.js','utf8');

  assert.match(productUi,/root\.renderTopbar=function/);
  assert.match(productUi,/root\.renderNav=function/);
  assert.match(productUi,/root\.renderHome=function/);
  assert.match(v3,/root\.renderIncome=function/);
  assert.match(v3,/root\.renderGoals=function/);
  assert.match(productUi,/root\.renderHistory=function/);
  assert.match(analytics,/root\.renderAnalytics=function/);
  assert.match(settings,/root\.renderSettings=renderSettings/);
});
