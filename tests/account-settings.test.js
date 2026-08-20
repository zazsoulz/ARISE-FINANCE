const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('account-settings.js','utf8');

test('account settings layer exposes canonical account controls',()=>{
  for(const token of [
    'canonicalAccountName',
    'canonicalAccountEmail',
    'canonicalAccountNotifications',
    'canonicalAccountAvatar',
    'canonicalPasswordChange',
    'canonicalLogout',
    'remote.updateAccount({name,notifications_enabled:notifications})',
    'remote.uploadAvatar(file)',
    'ARISE_SUPABASE.updatePassword(password)',
    'ARISE_SUPABASE.signOut()',
    'ARISE_LOCAL_ACCOUNTS.deactivate()'
  ]) assert.ok(source.includes(token),token+' missing');
});

test('password change requires a nontrivial password and never persists plaintext',()=>{
  assert.ok(source.includes('password.length<8'));
  assert.equal(/state\.account\.password\s*=/.test(source),false);
  assert.ok(source.includes('delete state.account.password'));
});

test('account settings augment financial settings instead of replacing them',()=>{
  assert.ok(source.includes('const originalRenderSettings=root.renderSettings'));
  assert.ok(source.includes('originalRenderSettings();'));
  assert.ok(source.includes('data-canonical-account-card'));
});
