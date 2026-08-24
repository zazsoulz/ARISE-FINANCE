const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  SETTINGS_MARKER,
  CATEGORY_EDITOR_BOUNDARY,
  removeLegacySettingsSource,
  removeRenderSettingsRetirementEntry
}=require('../scripts/remove-legacy-settings-source.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');

test('current shell has Settings source physically retired while category helpers remain',()=>{
  const cleaned=removeLegacySettingsSource(shell);
  assert.equal(cleaned,shell);
  assert.equal(cleaned.includes(SETTINGS_MARKER),false);
  assert.equal(/\bfunction\s+renderSettings\s*\(/.test(cleaned),false);
  assert.equal(cleaned.includes(CATEGORY_EDITOR_BOUNDARY),true);
  assert.equal(cleaned.includes('function saveCategoriesFromUI(){'),true);
});

test('settings cleanup is idempotent after physical removal',()=>{
  assert.equal(removeLegacySettingsSource(shell),shell);
});

test('settings cleanup refuses unexpected shared helpers in retired block',()=>{
  const fixture=`${SETTINGS_MARKER}\nfunction renderSettings(){}\nfunction sharedHelper(){}\n${CATEGORY_EDITOR_BOUNDARY}}`;
  assert.throws(()=>removeLegacySettingsSource(fixture),/unexpected helper sharedHelper/);
});

test('settings cleanup fails closed on damaged boundary',()=>{
  const fixture=`${SETTINGS_MARKER}\nfunction renderSettings(){}`;
  assert.throws(()=>removeLegacySettingsSource(fixture),/categoryEditor boundary missing/);
});

test('settings retirement registry is already removed and cleanup remains idempotent',()=>{
  assert.equal(index.includes('"renderSettings"'),false);
  assert.equal(removeRenderSettingsRetirementEntry(index),index);
});
