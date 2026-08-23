const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');
const navigationCompat=fs.readFileSync('navigation-compat.js','utf8');
const productUi=fs.readFileSync('product-ui.js','utf8');

test('effective shell retires the legacy navigation item model before canonical navigation loads',()=>{
  assert.match(shell,/const NAV_ITEMS\s*=\s*\[/,'compatibility shell should still expose the legacy model until physical shell cleanup');
  assert.match(index,/function retireLegacyNavigationConstants\(source\)/,'loader must explicitly retire the legacy navigation model');
  assert.match(index,/const marker="const NAV_ITEMS = \["/,'retirement must fail closed on the expected legacy model boundary');
  assert.match(index,/withoutLegacyNavigationModel=retireLegacyNavigationConstants\(source\)/,'navigation model must be removed before renderer retirement');
  assert.match(index,/\.\/navigation-compat\.js/,'canonical shared navigation helpers must load from navigation-compat');
  assert.match(productUi,/root\.renderNav=function\(\)/,'canonical product UI must own navigation rendering');
  assert.match(navigationCompat,/root\.bindNav=bindNav/,'canonical navigation compatibility layer must own navigation binding');
});

test('legacy navigation model is not duplicated in canonical navigation modules',()=>{
  assert.equal(navigationCompat.includes('const NAV_ITEMS'),false);
  assert.equal(productUi.includes('const NAV_ITEMS'),false);
});
