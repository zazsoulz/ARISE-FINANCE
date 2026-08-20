const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('profile-lifecycle.js','utf8');

test('financial profile lifecycle uses modal UI instead of prompt dialogs',()=>{
  assert.equal(/\bprompt\s*\(/.test(source),false);
  for(const token of [
    'newFinanceProfileName',
    'newFinanceProfileCurrency',
    'editFinanceProfileName',
    'editFinanceProfileCurrency',
    'data-edit-profile',
    'openModal(`'
  ]) assert.ok(source.includes(token),token+' missing');
});

test('profile edits persist locally first and update Supabase when available',()=>{
  for(const token of [
    'markProfileDirty(profile)',
    'saveState();',
    'remote.updateFinanceProfile(remoteId',
    'baseCurrency:profile.settings.currency',
    'syncMeta(profile,remoteId)',
    'ARISE_SYNC.schedule()'
  ]) assert.ok(source.includes(token),token+' missing');
});

test('profile deletion archives server profile before removing local data',()=>{
  assert.ok(source.includes('remote.archiveFinanceProfile(remoteId)'));
  assert.ok(source.includes('state.profiles=state.profiles.filter'));
  assert.ok(source.includes('Нельзя удалить единственный финансовый профиль'));
});
