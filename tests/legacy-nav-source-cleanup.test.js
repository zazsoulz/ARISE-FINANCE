const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  NAV_MARKER,
  LEGACY_NAV_SOURCE_START,
  RENDER_NAV_RETIREMENT,
  removeLegacyNavSource,
  removeRenderNavRetirementEntry
}=require('../scripts/remove-legacy-nav-source.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');

test('legacy nav cleanup targets the JS nav source rather than the earlier CSS NAV marker',()=>{
  const cssNavStart=shell.indexOf(NAV_MARKER);
  const jsNavStart=shell.indexOf(LEGACY_NAV_SOURCE_START);
  assert.ok(cssNavStart>=0,'CSS NAV marker should exist in current compatibility shell');
  assert.ok(jsNavStart>cssNavStart,'JS navigation source must be a later, more specific boundary');

  const cssPrefix=shell.slice(0,jsNavStart);
  const cleaned=removeLegacyNavSource(shell);
  assert.equal(cleaned.slice(0,cssPrefix.length),cssPrefix,'cleanup must preserve every byte before the JS navigation source');
  assert.equal(cleaned.includes('.nav{'),true,'legacy shell CSS must not be removed by JS cleanup');
  assert.equal(cleaned.includes('GRID / CARDS'),true,'unrelated compatibility styles must survive cleanup');
  assert.equal(cleaned.includes('<body>'),true,'shell document structure must survive cleanup');
  assert.equal(cleaned.includes('const STORAGE_KEY'),true,'shared compatibility runtime before navigation must survive cleanup');
});

test('legacy nav cleanup removes only duplicate nav model and renderer',()=>{
  const cleaned=removeLegacyNavSource(shell);

  assert.notEqual(cleaned,shell,'current compatibility shell should still contain removable legacy nav source');
  assert.equal(/\bconst\s+NAV_ITEMS\s*=/.test(cleaned),false,'legacy NAV_ITEMS must be removed');
  assert.equal(/\bfunction\s+renderNav\s*\(/.test(cleaned),false,'legacy renderNav must be removed');
  assert.equal(/\bfunction\s+bindNav\s*\(/.test(cleaned),true,'bindNav helper must survive physical cleanup');
  assert.equal(/\bfunction\s+profileSwitcher\s*\(/.test(cleaned),true,'profileSwitcher helper must survive physical cleanup');
  assert.equal(/\bfunction\s+bindProfileSwitcher\s*\(/.test(cleaned),true,'bindProfileSwitcher helper must survive physical cleanup');
  assert.equal(cleaned.includes('function renderHome(){'),true,'next staged legacy renderer must remain untouched');
});

test('physical nav cleanup also retires the matching loader registry entry',()=>{
  assert.equal(index.includes(RENDER_NAV_RETIREMENT),true,'current loader must still retire renderNav before physical cleanup');
  const cleaned=removeRenderNavRetirementEntry(index);
  assert.notEqual(cleaned,index);
  assert.equal(cleaned.includes(RENDER_NAV_RETIREMENT),false,'renderNav must leave the retirement registry with its source');
  assert.equal(cleaned.includes('["renderHome"'),true,'next staged renderer retirement must remain');
});

test('legacy nav cleanup is idempotent after source removal',()=>{
  const cleanedShell=removeLegacyNavSource(shell);
  const cleanedIndex=removeRenderNavRetirementEntry(index);
  assert.equal(removeLegacyNavSource(cleanedShell),cleanedShell);
  assert.equal(removeRenderNavRetirementEntry(cleanedIndex),cleanedIndex);
});

test('legacy nav cleanup fails closed on malformed JS boundaries',()=>{
  const malformedShell=shell.replace('function renderNav(){','function renamedLegacyNav(){');
  assert.throws(()=>removeLegacyNavSource(malformedShell),/renderNav missing/);

  const missingJsBoundary=shell.replace(LEGACY_NAV_SOURCE_START,`${NAV_MARKER}\n\n/* boundary damaged */\nconst NAV_ITEMS = [`);
  assert.throws(()=>removeLegacyNavSource(missingJsBoundary),/JS navigation boundary missing/);

  const malformedIndex=index.replace(RENDER_NAV_RETIREMENT,RENDER_NAV_RETIREMENT.replace('"renderNav",','"renderNav" ,'));
  assert.notEqual(malformedIndex,index,'malformed fixture must preserve renderNav while changing the exact registry entry');
  assert.throws(()=>removeRenderNavRetirementEntry(malformedIndex),/retirement entry is malformed/);
});
