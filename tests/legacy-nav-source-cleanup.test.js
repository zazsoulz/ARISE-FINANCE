const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {removeLegacyNavSource}=require('../scripts/remove-legacy-nav-source.js');

const shell=fs.readFileSync('app-shell.html','utf8');

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

test('legacy nav cleanup is idempotent after source removal',()=>{
  const cleaned=removeLegacyNavSource(shell);
  assert.equal(removeLegacyNavSource(cleaned),cleaned);
});

test('legacy nav cleanup fails closed on malformed boundary',()=>{
  const malformed=shell.replace('function renderNav(){','function renamedLegacyNav(){');
  assert.throws(()=>removeLegacyNavSource(malformed),/renderNav missing/);
});
