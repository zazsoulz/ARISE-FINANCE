const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const lifecycle=fs.readFileSync('profile-lifecycle.js','utf8');
const supabase=fs.readFileSync('supabase-client.js','utf8');

test('funded or historical profiles cannot be deleted before they have a recoverable server copy',()=>{
  assert.ok(lifecycle.includes('hasFinancialHistory(profile)&&!id'));
  assert.ok(lifecycle.includes('Профиль с финансовой историей нельзя удалить без серверной копии для восстановления'));
  assert.ok(lifecycle.includes('Локальные данные не удалены'));
});

test('server-backed profile deletion is archive-first and explicitly recoverable',()=>{
  const archive=lifecycle.indexOf('await remote.archiveFinanceProfile(id)');
  const localDelete=lifecycle.indexOf('state.profiles=state.profiles.filter');
  assert.ok(archive>=0,'remote archive missing');
  assert.ok(localDelete>archive,'local removal must happen only after remote archive succeeds');
  assert.ok(lifecycle.includes('Профиль перемещён в архив. Его можно восстановить в настройках.'));
});

test('archived profiles can be listed and restored through canonical Supabase profile APIs',()=>{
  for(const token of [
    'listArchivedFinanceProfiles',
    '.not("archived_at","is",null)',
    'restoreFinanceProfile',
    '.update({archived_at:null})',
    'PROFILE_FIELDS'
  ]) assert.ok(supabase.includes(token),token+' missing');
});

test('restore flow pulls the server bundle back into the local financial vault',()=>{
  for(const token of [
    'showArchivedProfiles',
    'data-restore-profile',
    'await remote.restoreFinanceProfile(profileRemoteId)',
    'await pull.pullAll()',
    'state.activeProfileId=local.id',
    'Профиль восстановлен вместе с серверной финансовой историей.'
  ]) assert.ok(lifecycle.includes(token),token+' missing');
});
