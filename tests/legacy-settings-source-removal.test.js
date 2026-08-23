const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  SETTINGS_MARKER,
  CATEGORY_EDITOR_BOUNDARY,
  RENDER_SETTINGS_RETIREMENT,
  removeLegacySettingsSource,
  removeRenderSettingsRetirementEntry
}=require('../scripts/remove-legacy-settings-source.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');

test('current shell can retire settings without touching category helpers',()=>{
  const cleaned=removeLegacySettingsSource(shell);
  assert.equal(cleaned.includes(SETTINGS_MARKER),false);
  assert.equal(/\bfunction\s+renderSettings\s*\(/.test(cleaned),false);
  assert.equal(cleaned.includes(CATEGORY_EDITOR_BOUNDARY),true);
  assert.equal(cleaned.includes('function saveCategoriesFromUI(){'),true);
});

test('settings cleanup is idempotent after physical removal',()=>{
  const once=removeLegacySettingsSource(shell);
  assert.equal(removeLegacySettingsSource(once),once);
});

test('settings cleanup refuses unexpected shared helpers in retired block',()=>{
  const fixture=`${SETTINGS_MARKER}\nfunction renderSettings(){}\nfunction sharedHelper(){}\n${CATEGORY_EDITOR_BOUNDARY}}`;
  assert.throws(()=>removeLegacySettingsSource(fixture),/unexpected helper sharedHelper/);
});

test('settings cleanup fails closed on damaged boundary',()=>{
  const fixture=`${SETTINGS_MARKER}\nfunction renderSettings(){}`;
  assert.throws(()=>removeLegacySettingsSource(fixture),/categoryEditor boundary missing/);
});

test('settings retirement registry entry is removed atomically and idempotently',()=>{
  assert.equal(index.includes(RENDER_SETTINGS_RETIREMENT),true);
  const cleaned=removeRenderSettingsRetirementEntry(index);
  assert.equal(cleaned.includes('"renderSettings"'),false);
  assert.equal(removeRenderSettingsRetirementEntry(cleaned),cleaned);
});
