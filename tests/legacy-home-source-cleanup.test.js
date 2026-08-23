const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  HOME_MARKER,
  GOAL_CARD_MARKER,
  RENDER_HOME_RETIREMENT,
  removeLegacyHomeSource,
  removeRenderHomeRetirementEntry
}=require('../scripts/remove-legacy-home-source.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');

function shellFixture(extra=''){
  return [
    '<script>',
    'function bindProfileSwitcher(){ return true; }',
    HOME_MARKER,
    'function renderHome(){',
    '  const page=document.getElementById("page");',
    '  page.innerHTML="home";',
    '}',
    extra,
    GOAL_CARD_MARKER,
    'function goalCard(){ return true; }',
    '</script>'
  ].join('\n');
}

function indexFixture(){
  return `const LEGACY_RENDERER_RETIREMENT=[\n${RENDER_HOME_RETIREMENT}    ["renderIncome","function incomeRow(tx){"]\n  ];`;
}

test('current compatibility shell has an exactly bounded removable legacy home renderer',()=>{
  const homeStart=shell.indexOf(HOME_MARKER);
  const goalStart=shell.indexOf(GOAL_CARD_MARKER,homeStart+HOME_MARKER.length);
  assert.ok(homeStart>=0,'HOME marker missing');
  assert.ok(goalStart>homeStart,'GOAL CARD marker must follow HOME');
  const block=shell.slice(homeStart,goalStart);
  assert.equal((block.match(/\bfunction\s+renderHome\s*\(/g)||[]).length,1);
  assert.equal(block.includes('function goalCard('),false,'goalCard must remain outside cleanup boundary');
});

test('home cleanup removes only the retired renderer block',()=>{
  const fixture=shellFixture();
  const cleaned=removeLegacyHomeSource(fixture);
  assert.equal(cleaned.includes('function renderHome('),false);
  assert.equal(cleaned.includes(HOME_MARKER),false);
  assert.equal(cleaned.includes('function bindProfileSwitcher('),true);
  assert.equal(cleaned.includes(GOAL_CARD_MARKER),true);
  assert.equal(cleaned.includes('function goalCard('),true);
});

test('home cleanup is idempotent after physical removal',()=>{
  const once=removeLegacyHomeSource(shellFixture());
  assert.equal(removeLegacyHomeSource(once),once);
});

test('home cleanup fails closed if the next boundary is missing',()=>{
  const malformed=shellFixture().replace(GOAL_CARD_MARKER,'/* missing */');
  assert.throws(()=>removeLegacyHomeSource(malformed),/GOAL CARD boundary missing/);
});

test('home cleanup refuses unexpected helpers inside the removal block',()=>{
  const malformed=shellFixture('function sharedHelper(){ return true; }');
  assert.throws(()=>removeLegacyHomeSource(malformed),/unexpected helper/);
});

test('retirement cleanup removes exactly renderHome and is idempotent',()=>{
  const source=indexFixture();
  const cleaned=removeRenderHomeRetirementEntry(source);
  assert.equal(cleaned.includes('"renderHome"'),false);
  assert.equal(cleaned.includes('"renderIncome"'),true);
  assert.equal(removeRenderHomeRetirementEntry(cleaned),cleaned);
});

test('current shell and retirement registry remain atomic before physical cleanup',()=>{
  const shellChanged=removeLegacyHomeSource(shell)!==shell;
  const indexChanged=removeRenderHomeRetirementEntry(index)!==index;
  assert.equal(shellChanged,true,'current shell should still contain legacy renderHome source');
  assert.equal(indexChanged,true,'current registry should still contain renderHome retirement entry');
  assert.equal(shellChanged,indexChanged);
});
