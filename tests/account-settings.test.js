const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('account-settings.js','utf8');
const settingsUi=fs.readFileSync('settings-ui.js','utf8');

test('account settings layer exposes canonical account controls',()=>{
  for(const token of [
    'canonicalAccountName','canonicalAccountEmail','canonicalAccountNotifications','canonicalAccountAvatar',
    'canonicalPasswordChange','canonicalLogout','remote.updateAccount({name,notifications_enabled:notifications})',
    'remote.uploadAvatar(file)','ARISE_SUPABASE.updatePassword(password)','ARISE_SUPABASE.signOut()','ARISE_LOCAL_ACCOUNTS.deactivate()'
  ]) assert.ok(source.includes(token),token+' missing');
});

test('password change requires a nontrivial password and never persists plaintext',()=>{
  assert.ok(source.includes('password.length<8'));
  assert.equal(/state\.account\.password\s*=/.test(source),false);
  assert.ok(source.includes('delete state.account.password'));
});

test('account settings augment canonical financial settings through the coordinator',()=>{
  assert.doesNotMatch(source,/root\.renderSettings\s*=/);
  assert.ok(source.includes('function enhanceSettings()'));
  assert.ok(source.includes('data-canonical-account-card'));
  assert.match(settingsUi,/function\s+renderSettings\(\)/);
  assert.match(settingsUi,/id="settingsProfileName"/);
  assert.match(settingsUi,/id="saveAccount"/);
  assert.match(settingsUi,/ARISE_ACCOUNT_SETTINGS/);
  assert.match(settingsUi,/enhanceAccountSettings\(\)/);
  assert.doesNotMatch(settingsUi,/baseRenderSettings/);
});
