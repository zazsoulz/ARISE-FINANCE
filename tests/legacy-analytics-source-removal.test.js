const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  ANALYTICS_MARKER,
  SETTINGS_BOUNDARY,
  RENDER_ANALYTICS_RETIREMENT,
  removeLegacyAnalyticsSource,
  removeRenderAnalyticsRetirementEntry
}=require('../scripts/remove-legacy-analytics-source.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');

test('current shell can retire analytics without touching settings',()=>{
  const cleaned=removeLegacyAnalyticsSource(shell);
  assert.equal(cleaned.includes(ANALYTICS_MARKER),false);
  assert.equal(/\bfunction\s+renderAnalytics\s*\(/.test(cleaned),false);
  assert.equal(cleaned.includes(SETTINGS_BOUNDARY),true);
  assert.equal(cleaned.includes('function renderSettings(){'),true);
});

test('analytics cleanup is idempotent after physical removal',()=>{
  const once=removeLegacyAnalyticsSource(shell);
  assert.equal(removeLegacyAnalyticsSource(once),once);
});

test('analytics cleanup refuses unexpected shared helpers in retired block',()=>{
  const fixture=`${ANALYTICS_MARKER}\nfunction renderAnalytics(){}\nfunction sharedHelper(){}\n${SETTINGS_BOUNDARY}\nfunction renderSettings(){}`;
  assert.throws(()=>removeLegacyAnalyticsSource(fixture),/unexpected helper sharedHelper/);
});

test('analytics cleanup fails closed on damaged boundary',()=>{
  const fixture=`${ANALYTICS_MARKER}\nfunction renderAnalytics(){}`;
  assert.throws(()=>removeLegacyAnalyticsSource(fixture),/SETTINGS boundary missing/);
});

test('retirement registry entry is removed atomically and idempotently',()=>{
  assert.equal(index.includes(RENDER_ANALYTICS_RETIREMENT),true);
  const cleaned=removeRenderAnalyticsRetirementEntry(index);
  assert.equal(cleaned.includes('"renderAnalytics"'),false);
  assert.equal(removeRenderAnalyticsRetirementEntry(cleaned),cleaned);
});