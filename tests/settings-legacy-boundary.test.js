const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');
const accountSettings=fs.readFileSync('account-settings.js','utf8');
const profileLifecycle=fs.readFileSync('profile-lifecycle.js','utf8');
const settingsUi=fs.readFileSync('settings-ui.js','utf8');

const retired=['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics'];

test('settings remains the only retained legacy screen base while canonical settings owns composition',()=>{
  for(const name of retired){
    assert.match(index,new RegExp(`retireLegacyRenderer\\(html,\\"${name}\\"`),`${name} should stay retired by the production loader`);
  }
  assert.doesNotMatch(index,/retireLegacyRenderer\(html,"renderSettings"/,'legacy settings base remains until its markup and handlers are extracted');
  assert.match(shell,/function renderSettings\(\)\{/,'compatibility shell must still provide the settings base renderer for this staged pass');
  assert.match(settingsUi,/const baseRenderSettings=root\.renderSettings/);
  assert.match(settingsUi,/root\.renderSettings=renderSettings/);
});

test('account and profile modules expose enhancers instead of wrapping renderSettings independently',()=>{
  assert.doesNotMatch(accountSettings,/root\.renderSettings\s*=/);
  assert.doesNotMatch(profileLifecycle,/root\.renderSettings\s*=/);
  assert.match(accountSettings,/function enhanceSettings\(\)/);
  assert.match(accountSettings,/ARISE_ACCOUNT_SETTINGS=\{enhanceSettings/);
  assert.match(profileLifecycle,/function enhanceSettings\(\)/);
  assert.match(profileLifecycle,/ARISE_PROFILE_LIFECYCLE=.*enhanceSettings/);
  assert.match(settingsUi,/ARISE_ACCOUNT_SETTINGS/);
  assert.match(settingsUi,/ARISE_PROFILE_LIFECYCLE/);
});

test('canonical settings coordinator loads after enhancers and before bootstrap-era decorators',()=>{
  const account=index.indexOf('./account-settings.js');
  const profile=index.indexOf('./profile-lifecycle.js');
  const settings=index.indexOf('./settings-ui.js');
  const onboarding=index.indexOf('./onboarding.js');
  const bootstrap=index.indexOf('./financial-bootstrap.js');
  assert.ok(account>=0&&profile>account&&settings>profile&&onboarding>settings&&bootstrap>onboarding);
});

test('future settings base retirement must first replace legacy DOM contracts used by canonical modules',()=>{
  const requiredIds=[
    'settingsCurrency',
    'saveProfileSettings',
    'newProfile',
    'reservePercent',
    'saveReserve'
  ];
  for(const id of requiredIds){
    assert.equal(shell.includes(`id="${id}"`),true,`${id} must stay available until canonical settings owns its markup and handler`);
  }
});
