const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  INCOME_MARKER,
  INCOME_ROW_MARKER,
  RENDER_INCOME_RETIREMENT,
  removeLegacyIncomeSource,
  removeRenderIncomeRetirementEntry
}=require('../scripts/remove-legacy-income-source.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');

function shellFixture(extra=''){
  return [
    '<script>',
    'function goalCard(){ return true; }',
    INCOME_MARKER,
    'function renderIncome(){',
    '  const page=document.getElementById("page");',
    '  page.innerHTML="income";',
    '}',
    extra,
    INCOME_ROW_MARKER,
    '  return "row";',
    '}',
    '/* =========================================================',
    '   INCOME MODAL',
    '========================================================= */',
    'function showIncomeModal(){ return true; }',
    '</script>'
  ].join('\n');
}

function indexFixture(){
  return `const LEGACY_RENDERER_RETIREMENT=[\n${RENDER_INCOME_RETIREMENT}    ["renderGoals",\`/* GOAL MODAL */\`]\n  ];`;
}

test('current compatibility shell income renderer is staged or physically retired',()=>{
  const markerStart=shell.indexOf(INCOME_MARKER);
  const hasRenderer=/\bfunction\s+renderIncome\s*\(/.test(shell);

  if(!hasRenderer){
    assert.equal(index.includes('"renderIncome"'),false,'retired registry must not contain renderIncome');
    assert.ok(shell.includes(INCOME_ROW_MARKER),'incomeRow must remain after income renderer retirement');
    return;
  }

  assert.ok(markerStart>=0,'INCOME PAGE marker must exist while renderIncome exists');
  const rowStart=shell.indexOf(INCOME_ROW_MARKER,markerStart+INCOME_MARKER.length);
  assert.ok(rowStart>markerStart,'incomeRow must follow renderIncome');
  const block=shell.slice(markerStart,rowStart);
  assert.equal((block.match(/\bfunction\s+renderIncome\s*\(/g)||[]).length,1);
});

test('income cleanup removes only renderIncome and preserves incomeRow plus modal helpers',()=>{
  const fixture=shellFixture();
  const cleaned=removeLegacyIncomeSource(fixture);
  assert.equal(cleaned.includes('function renderIncome('),false);
  assert.equal(cleaned.includes(INCOME_MARKER),false);
  assert.equal(cleaned.includes('function goalCard('),true);
  assert.equal(cleaned.includes(INCOME_ROW_MARKER),true);
  assert.equal(cleaned.includes('function showIncomeModal('),true);
});

test('income cleanup is idempotent after physical removal',()=>{
  const once=removeLegacyIncomeSource(shellFixture());
  assert.equal(removeLegacyIncomeSource(once),once);
});

test('income cleanup fails closed if incomeRow boundary is missing',()=>{
  const malformed=shellFixture().replace(INCOME_ROW_MARKER,'function missingRow(tx){');
  assert.throws(()=>removeLegacyIncomeSource(malformed),/incomeRow boundary missing/);
});

test('income cleanup refuses unexpected helpers inside renderer boundary',()=>{
  const malformed=shellFixture('function sharedHelper(){ return true; }');
  assert.throws(()=>removeLegacyIncomeSource(malformed),/unexpected helper/);
});

test('retirement cleanup removes exactly renderIncome and is idempotent',()=>{
  const source=indexFixture();
  const cleaned=removeRenderIncomeRetirementEntry(source);
  assert.equal(cleaned.includes('"renderIncome"'),false);
  assert.equal(cleaned.includes('"renderGoals"'),true);
  assert.equal(removeRenderIncomeRetirementEntry(cleaned),cleaned);
});

test('current shell and retirement registry are atomically staged or retired',()=>{
  const shellChanged=removeLegacyIncomeSource(shell)!==shell;
  const indexChanged=removeRenderIncomeRetirementEntry(index)!==index;
  assert.equal(shellChanged,indexChanged,'shell source and retirement registry must change together');

  if(!shellChanged){
    assert.equal(/\bfunction\s+renderIncome\s*\(/.test(shell),false,'retired shell must not contain renderIncome');
    assert.equal(index.includes('"renderIncome"'),false,'retired registry must not contain renderIncome');
  }
});
