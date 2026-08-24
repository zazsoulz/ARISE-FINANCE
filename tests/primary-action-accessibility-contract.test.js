const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const productUI=fs.readFileSync('product-ui.js','utf8');
const settingsUI=fs.readFileSync('settings-ui.js','utf8');
const reserveUI=fs.readFileSync('reserve-lifecycle-ui.js','utf8');

test('primary navigation exposes five labeled button actions',()=>{
  for(const page of ['home','income','goals','history','analytics']){
    assert.match(productUI,new RegExp(`data-page=\\"\\$\\{id\\}\\"|data-page=[\"']${page}[\"']`));
  }
  assert.match(productUI,/type=\"button\" class=\"product-nav-item/);
  assert.match(productUI,/aria-label=\"\$\{label\}\"/);
});

test('global sync and profile controls remain explicit accessible buttons',()=>{
  assert.match(productUI,/class=\"product-sync \$\{sync\.kind\}\"/);
  assert.match(productUI,/aria-label=\"\$\{escapeHTML\(sync\.action\|\|sync\.label\)\}\"/);
  assert.match(productUI,/class=\"avatar product-avatar\" data-page=\"settings\" aria-label=\"Настройки профиля\"/);
});

test('quick financial actions are real buttons and named in visible copy',()=>{
  assert.match(productUI,/type=\"button\" class=\"product-quick product-quick-income\"/);
  assert.match(productUI,/type=\"button\" class=\"product-quick product-quick-expense\"/);
  assert.match(productUI,/<strong>Доход<\/strong>/);
  assert.match(productUI,/<strong>Расход<\/strong>/);
});

test('settings and reserve primary actions use button controls rather than dead labels',()=>{
  assert.match(settingsUI,/<button[^>]+id=\"saveProfileSettings\"/);
  assert.match(settingsUI,/<button[^>]+id=\"saveCategories\"/);
  assert.match(reserveUI,/<button[^>]+id=\"reserveDepositAction\"/);
  assert.match(reserveUI,/<button[^>]+id=\"reserveWithdrawAction\"/);
  assert.match(reserveUI,/<button[^>]+id=\"saveReserveLifecycleSettings\"/);
});
