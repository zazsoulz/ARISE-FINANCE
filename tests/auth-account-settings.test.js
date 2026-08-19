const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('auth-ui.js','utf8');

test('account settings expose canonical account controls',()=>{
  for(const token of [
    'accountNotifications',
    'accountNewPassword',
    'changeAccountPassword',
    'logoutAccount',
    'remote.updateAccount({name:nextName,notifications_enabled:notifications})',
    'remote.uploadAvatar(file)',
    'ARISE_SUPABASE.updatePassword(password)',
    'ARISE_SUPABASE.signOut()',
    'ARISE_LOCAL_ACCOUNTS.deactivate()'
  ]) assert.ok(source.includes(token),token+' missing');
});

test('account settings never persist a plaintext password',()=>{
  assert.equal(/state\.account\.password\s*=/.test(source),false);
  assert.ok(source.includes('delete state.account.password'));
});

test('password change is guarded by a local minimum length check',()=>{
  assert.ok(source.includes('password.length<6'));
});

test('settings augment rather than replace financial profile settings',()=>{
  assert.ok(source.includes('const originalRenderSettings=root.renderSettings'));
  assert.ok(source.includes('originalRenderSettings();'));
  assert.ok(source.includes('augmentAccountSettings();'));
});
