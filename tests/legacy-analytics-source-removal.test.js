const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  ANALYTICS_MARKER,
  SETTINGS_BOUNDARY,
  removeLegacyAnalyticsSource,
  removeRenderAnalyticsRetirementEntry
}=require('../scripts/remove-legacy-analytics-source.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');

test('analytics cleanup stays idempotent after Analytics and Settings are physically retired',()=>{
  const cleaned=removeLegacyAnalyticsSource(shell);
  assert.equal(cleaned,shell);
  assert.equal(cleaned.includes(ANALYTICS_MARKER),false);
  assert.equal(/\bfunction\s+renderAnalytics\s*\(/.test(cleaned),false);
  assert.equal(/\bfunction\s+renderSettings\s*\(/.test(cleaned),false);
  assert.match(cleaned,/function\s+categoryEditor\s*\(/);
});

test('analytics cleanup is idempotent after physical removal',()=>{
  assert.equal(removeLegacyAnalyticsSource(shell),shell);
});

test('analytics cleanup refuses unexpected shared helpers in retired block',()=>{
  const fixture=`${ANALYTICS_MARKER}\nfunction renderAnalytics(){}\nfunction sharedHelper(){}\n${SETTINGS_BOUNDARY}\nfunction renderSettings(){}`;
  assert.throws(()=>removeLegacyAnalyticsSource(fixture),/unexpected helper sharedHelper/);
});

test('analytics cleanup fails closed on damaged boundary',()=>{
  const fixture=`${ANALYTICS_MARKER}\nfunction renderAnalytics(){}`;
  assert.throws(()=>removeLegacyAnalyticsSource(fixture),/SETTINGS boundary missing/);
});

test('analytics retirement registry is physically retired and cleanup remains idempotent',()=>{
  const cleaned=removeRenderAnalyticsRetirementEntry(index);
  assert.equal(cleaned,index);
  assert.equal(cleaned.includes('"renderAnalytics"'),false);
});
