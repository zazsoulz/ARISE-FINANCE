const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');
const accountSettings=fs.readFileSync('account-settings.js','utf8');
const profileLifecycle=fs.readFileSync('profile-lifecycle.js','utf8');
const productRules=fs.readFileSync('product-rules.js','utf8');
const settingsUi=fs.readFileSync('settings-ui.js','utf8');

function retirementRegistry(){
  const match=index.match(/const LEGACY_RENDERER_RETIREMENT=\[([\s\S]*?)\n  \];/);
  assert.ok(match,'central retirement registry missing');
  return match[1];
}

test('canonical settings owns markup after all primary compatibility renderers are physically retired',()=>{
  for(const name of ['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics','renderSettings']){
    assert.doesNotMatch(shell,new RegExp(`function\\s+${name}\\s*\\(`),`${name} should stay physically retired`);
  }
  assert.doesNotMatch(shell,/\bconst\s+NAV_ITEMS\s*=/,'legacy navigation model should stay physically retired');
  const registry=retirementRegistry();
  assert.deepEqual([...registry.matchAll(/\["(render[A-Za-z]+)"/g)].map(match=>match[1]),[]);
  assert.match(index,/html=retireLegacyRenderers\(html\);/);
  assert.match(settingsUi,/function renderSettings\(\)\{/);
  assert.match(settingsUi,/id="settingsCurrency"/);
  assert.match(settingsUi,/id="saveProfileSettings"/);
  assert.match(settingsUi,/id="newProfile"/);
  assert.match(settingsUi,/id="reservePercent"/);
  assert.match(settingsUi,/id="saveReserve"/);
  assert.match(settingsUi,/root\.renderSettings=renderSettings/);
  assert.doesNotMatch(settingsUi,/baseRenderSettings/);
});

test('account profile and product rule modules expose enhancers instead of wrapping renderSettings independently',()=>{
  assert.doesNotMatch(accountSettings,/root\.renderSettings\s*=/);
  assert.doesNotMatch(profileLifecycle,/root\.renderSettings\s*=/);
  assert.doesNotMatch(productRules,/root\.renderSettings\s*=/);
  assert.doesNotMatch(productRules,/originalRenderSettings/);
  assert.match(accountSettings,/function enhanceSettings\(\)/);
  assert.match(accountSettings,/ARISE_ACCOUNT_SETTINGS=\{enhanceSettings/);
  assert.match(profileLifecycle,/function enhanceSettings\(\)/);
  assert.match(profileLifecycle,/ARISE_PROFILE_LIFECYCLE=.*enhanceSettings/);
  assert.match(productRules,/function enhanceSettings\(\)/);
  assert.match(settingsUi,/ARISE_ACCOUNT_SETTINGS/);
  assert.match(settingsUi,/ARISE_PROFILE_LIFECYCLE/);
  assert.match(settingsUi,/ARISE_PRODUCT_RULES/);
});

test('canonical settings coordinator loads after enhancers and before bootstrap-era decorators',()=>{
  const product=index.indexOf('./product-rules.js'),account=index.indexOf('./account-settings.js'),profile=index.indexOf('./profile-lifecycle.js'),settings=index.indexOf('./settings-ui.js'),onboarding=index.indexOf('./onboarding.js'),bootstrap=index.indexOf('./financial-bootstrap.js');
  assert.ok(product>=0&&account>product&&profile>account&&settings>profile&&onboarding>settings&&bootstrap>onboarding);
});

test('shared compatibility helpers remain available after legacy Settings source retirement',()=>{
  const registry=retirementRegistry();
  assert.doesNotMatch(registry,/\["renderSettings"/);
  for(const helper of ['function categoryEditor(category){','function saveCategoriesFromUI(){','function exportData(){','function importData(event){','function resetData(){']){
    assert.equal(shell.includes(helper),true,`${helper} must remain available until helper extraction is reviewed separately`);
  }
});
