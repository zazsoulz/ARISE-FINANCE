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

test('current compatibility shell home source is either staged or fully retired',()=>{
  const homeStart=shell.indexOf(HOME_MARKER);
  const hasRenderer=/\bfunction\s+renderHome\s*\(/.test(shell);

  if(homeStart<0){
    assert.equal(hasRenderer,false,'renderHome must not survive without its HOME boundary');
    assert.ok(shell.includes(GOAL_CARD_MARKER),'GOAL CARD marker must remain after home retirement');
    assert.ok(shell.includes('function goalCard('),'goalCard must remain after home retirement');
    return;
  }

  const goalStart=shell.indexOf(GOAL_CARD_MARKER,homeStart+HOME_MARKER.length);
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

test('current shell and retirement registry are atomically staged or retired',()=>{
  const shellChanged=removeLegacyHomeSource(shell)!==shell;
  const indexChanged=removeRenderHomeRetirementEntry(index)!==index;
  assert.equal(shellChanged,indexChanged,'shell source and retirement registry must change together');

  if(!shellChanged){
    assert.equal(/\bfunction\s+renderHome\s*\(/.test(shell),false,'retired shell must not contain renderHome');
    const registryStart=index.indexOf('const LEGACY_RENDERER_RETIREMENT=[');
    const registryEnd=registryStart<0?-1:index.indexOf('];',registryStart);
    if(registryStart>=0&&registryEnd>registryStart){
      const registry=index.slice(registryStart,registryEnd+2);
      assert.equal(registry.includes('"renderHome"'),false,'retired registry must not contain renderHome');
    }
  }
});