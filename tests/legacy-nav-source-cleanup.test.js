const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  RENDER_NAV_RETIREMENT,
  removeLegacyNavSource,
  removeRenderNavRetirementEntry
}=require('../scripts/remove-legacy-nav-source.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');

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

test('legacy nav cleanup fails closed on malformed boundaries',()=>{
  const malformedShell=shell.replace('function renderNav(){','function renamedLegacyNav(){');
  assert.throws(()=>removeLegacyNavSource(malformedShell),/renderNav missing/);

  const malformedIndex=index.replace(RENDER_NAV_RETIREMENT,RENDER_NAV_RETIREMENT.replace('    ["renderNav"','     ["renderNav"'));
  assert.notEqual(malformedIndex,index,'malformed fixture must preserve renderNav while changing the exact registry entry');
  assert.throws(()=>removeRenderNavRetirementEntry(malformedIndex),/retirement entry is malformed/);
});
