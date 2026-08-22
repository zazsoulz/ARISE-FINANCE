const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');
const accountSettings=fs.readFileSync('account-settings.js','utf8');
const profileLifecycle=fs.readFileSync('profile-lifecycle.js','utf8');

const retired=['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics'];

test('settings is the only intentionally retained legacy screen renderer',()=>{
  for(const name of retired){
    assert.match(index,new RegExp(`retireLegacyRenderer\\(html,\\"${name}\\"`),`${name} should stay retired by the production loader`);
  }
  assert.doesNotMatch(index,/retireLegacyRenderer\(html,"renderSettings"/,'renderSettings must not be stripped until a canonical settings owner exists');
  assert.match(shell,/function renderSettings\(\)\{/,'compatibility shell must still provide the settings base renderer');
});

test('settings decorators explicitly depend on the retained base renderer',()=>{
  assert.match(accountSettings,/const originalRenderSettings=root\.renderSettings/);
  assert.match(accountSettings,/root\.renderSettings=function\(\)\{\s*originalRenderSettings\(\)/);
  assert.match(profileLifecycle,/const previousRenderSettings=root\.renderSettings/);
  assert.match(profileLifecycle,/root\.renderSettings=function\(\)\{\s*previousRenderSettings\(\)/);
});

test('future settings retirement must first replace legacy DOM contracts used by canonical modules',()=>{
  const requiredIds=[
    'settingsCurrency',
    'saveProfileSettings',
    'newProfile',
    'reservePercent',
    'saveReserve'
  ];
  for(const id of requiredIds){
    assert.equal(shell.includes(`id="${id}"`),true,`${id} must stay available until canonical settings owns it`);
  }
});
