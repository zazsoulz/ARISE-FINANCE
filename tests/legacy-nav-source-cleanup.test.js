const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  NAV_MARKER,
  LEGACY_NAV_SOURCE_START,
  PROFILE_MARKER,
  RENDER_NAV_RETIREMENT,
  removeLegacyNavSource,
  removeRenderNavRetirementEntry
}=require('../scripts/remove-legacy-nav-source.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');

function legacyShellFixture(){
  return [
    '<style>',
    NAV_MARKER,
    '.nav{display:flex}',
    '</style>',
    '<body><script>',
    'const STORAGE_KEY="fixture";',
    LEGACY_NAV_SOURCE_START,
    '  ["home","Главная"]',
    '];',
    'function renderNav(){ return NAV_ITEMS.length; }',
    'function bindNav(){ return true; }',
    '',
    PROFILE_MARKER,
    'function profileSwitcher(){ return ""; }',
    'function bindProfileSwitcher(){ return true; }',
    'function renderHome(){ return true; }',
    '</script></body>'
  ].join('\n');
}

function legacyIndexFixture(){
  return `const LEGACY_RENDERER_RETIREMENT=[\n${RENDER_NAV_RETIREMENT}    ["renderHome","next"]\n  ];`;
}

test('cleanup targets JS nav source rather than earlier CSS NAV marker',()=>{
  const fixture=legacyShellFixture();
  const cssNavStart=fixture.indexOf(NAV_MARKER);
  const jsNavStart=fixture.indexOf(LEGACY_NAV_SOURCE_START);
  assert.ok(cssNavStart>=0&&jsNavStart>cssNavStart);

  const prefix=fixture.slice(0,jsNavStart);
  const cleaned=removeLegacyNavSource(fixture);
  assert.equal(cleaned.slice(0,prefix.length),prefix,'everything before JS nav source must stay byte-identical');
  assert.match(cleaned,/\.nav\{display:flex\}/,'CSS nav styles must survive');
  assert.match(cleaned,/const STORAGE_KEY="fixture"/,'shared runtime before navigation must survive');
  assert.doesNotMatch(cleaned,/\bconst\s+NAV_ITEMS\s*=/);
  assert.doesNotMatch(cleaned,/function\s+renderNav\s*\(/);
  assert.match(cleaned,/function\s+bindNav\s*\(/);
  assert.match(cleaned,/function\s+profileSwitcher\s*\(/);
  assert.match(cleaned,/function\s+bindProfileSwitcher\s*\(/);
  assert.match(cleaned,/function\s+renderHome\s*\(/);
});

test('current compatibility shell has physical nav source and registry entry retired',()=>{
  assert.doesNotMatch(shell,/\bconst\s+NAV_ITEMS\s*=/);
  assert.doesNotMatch(shell,/function\s+renderNav\s*\(/);
  assert.match(shell,/function\s+bindNav\s*\(/);
  assert.match(shell,/function\s+profileSwitcher\s*\(/);
  assert.match(shell,/function\s+bindProfileSwitcher\s*\(/);
  assert.match(shell,/function\s+renderHome\s*\(/);
  assert.equal(index.includes(RENDER_NAV_RETIREMENT),false);
  assert.equal(removeLegacyNavSource(shell),shell,'cleanup must be idempotent on physically retired shell');
  assert.equal(removeRenderNavRetirementEntry(index),index,'registry cleanup must be idempotent after retirement');
});

test('loader registry cleanup removes only renderNav fixture entry',()=>{
  const fixture=legacyIndexFixture();
  const cleaned=removeRenderNavRetirementEntry(fixture);
  assert.equal(cleaned.includes(RENDER_NAV_RETIREMENT),false);
  assert.match(cleaned,/\["renderHome","next"\]/);
});

test('cleanup fails closed on malformed legacy JS boundaries',()=>{
  const fixture=legacyShellFixture();
  assert.throws(()=>removeLegacyNavSource(fixture.replace('function renderNav(){','function renamedLegacyNav(){')),/renderNav missing/);
  assert.throws(()=>removeLegacyNavSource(fixture.replace(LEGACY_NAV_SOURCE_START,`${NAV_MARKER}\n\n/* boundary damaged */\nconst NAV_ITEMS = [`)),/JS navigation boundary missing/);
  assert.throws(()=>removeLegacyNavSource(fixture.replace(PROFILE_MARKER,'/* PROFILE boundary damaged */')),/profile-switch boundary missing/);

  const registry=legacyIndexFixture();
  const malformed=registry.replace(RENDER_NAV_RETIREMENT,RENDER_NAV_RETIREMENT.replace('"renderNav",','"renderNav" ,'));
  assert.throws(()=>removeRenderNavRetirementEntry(malformed),/retirement entry is malformed/);
});
