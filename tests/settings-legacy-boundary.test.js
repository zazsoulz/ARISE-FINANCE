const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');
const accountSettings=fs.readFileSync('account-settings.js','utf8');
const profileLifecycle=fs.readFileSync('profile-lifecycle.js','utf8');
const settingsUi=fs.readFileSync('settings-ui.js','utf8');

const retired=['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics','renderSettings'];

test('canonical settings owns markup while physical compatibility source remains staged',()=>{
  for(const name of retired) assert.match(index,new RegExp(`retireLegacyRenderer\\(html,\\"${name}\\"`),`${name} should stay retired by the production loader`);
  assert.match(shell,/function renderSettings\(\)\{/,'physical compatibility source remains until helper extraction/source cleanup');
  assert.match(settingsUi,/function renderSettings\(\)\{/);
  assert.match(settingsUi,/id="settingsCurrency"/);
  assert.match(settingsUi,/id="saveProfileSettings"/);
  assert.match(settingsUi,/id="newProfile"/);
  assert.match(settingsUi,/id="reservePercent"/);
  assert.match(settingsUi,/id="saveReserve"/);
  assert.match(settingsUi,/root\.renderSettings=renderSettings/);
  assert.doesNotMatch(settingsUi,/baseRenderSettings/);
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
  const account=index.indexOf('./account-settings.js'),profile=index.indexOf('./profile-lifecycle.js'),settings=index.indexOf('./settings-ui.js'),onboarding=index.indexOf('./onboarding.js'),bootstrap=index.indexOf('./financial-bootstrap.js');
  assert.ok(account>=0&&profile>account&&settings>profile&&onboarding>settings&&bootstrap>onboarding);
});

test('legacy settings renderer is excluded without removing shared compatibility helpers yet',()=>{
  assert.match(index,/retireLegacyRenderer\(html,"renderSettings","function categoryEditor\(category\)\{"\)/);
  for(const helper of ['function categoryEditor(category){','function saveCategoriesFromUI(){','function exportData(){','function importData(event){','function resetData(){']){
    assert.equal(shell.includes(helper),true,`${helper} must remain available until helper extraction is reviewed separately`);
  }
});
