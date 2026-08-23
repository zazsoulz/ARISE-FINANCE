const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  GOALS_MARKER,
  GOAL_MODAL_MARKER,
  RENDER_GOALS_RETIREMENT,
  removeLegacyGoalsSource,
  removeRenderGoalsRetirementEntry
}=require('../scripts/remove-legacy-goals-source.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');

function shellFixture(extra=''){
  return [
    '<script>',
    'function saveExpense(){ return true; }',
    GOALS_MARKER,
    'function renderGoals(){',
    '  const page=document.getElementById("page");',
    '  page.innerHTML="goals";',
    '}',
    extra,
    GOAL_MODAL_MARKER,
    'function showGoalModal(){ return true; }',
    '</script>'
  ].join('\n');
}

function indexFixture(){
  return `const LEGACY_RENDERER_RETIREMENT=[\n${RENDER_GOALS_RETIREMENT}    ["renderHistory","function historyTransaction(tx){"]\n  ];`;
}

test('current compatibility shell goals renderer is staged or physically retired',()=>{
  const markerStart=shell.indexOf(GOALS_MARKER);
  const hasRenderer=/\bfunction\s+renderGoals\s*\(/.test(shell);

  if(!hasRenderer){
    assert.equal(index.includes('"renderGoals"'),false,'retired registry must not contain renderGoals');
    assert.ok(shell.includes(GOAL_MODAL_MARKER),'goal modal boundary must remain after goals renderer retirement');
    assert.ok(shell.includes('function showGoalModal('),'goal modal workflow must remain after goals renderer retirement');
    return;
  }

  assert.ok(markerStart>=0,'GOALS PAGE marker must exist while renderGoals exists');
  const modalStart=shell.indexOf(GOAL_MODAL_MARKER,markerStart+GOALS_MARKER.length);
  assert.ok(modalStart>markerStart,'GOAL MODAL must follow renderGoals');
  const block=shell.slice(markerStart,modalStart);
  assert.equal((block.match(/\bfunction\s+renderGoals\s*\(/g)||[]).length,1);
});

test('goals cleanup removes only renderGoals and preserves goal modal lifecycle',()=>{
  const fixture=shellFixture();
  const cleaned=removeLegacyGoalsSource(fixture);
  assert.equal(cleaned.includes('function renderGoals('),false);
  assert.equal(cleaned.includes(GOALS_MARKER),false);
  assert.equal(cleaned.includes('function saveExpense('),true);
  assert.equal(cleaned.includes(GOAL_MODAL_MARKER),true);
  assert.equal(cleaned.includes('function showGoalModal('),true);
});

test('goals cleanup is idempotent after physical removal',()=>{
  const once=removeLegacyGoalsSource(shellFixture());
  assert.equal(removeLegacyGoalsSource(once),once);
});

test('goals cleanup fails closed if goal modal boundary is missing',()=>{
  const malformed=shellFixture().replace(GOAL_MODAL_MARKER,'/* missing */');
  assert.throws(()=>removeLegacyGoalsSource(malformed),/GOAL MODAL boundary missing/);
});

test('goals cleanup refuses unexpected helpers inside renderer boundary',()=>{
  const malformed=shellFixture('function sharedGoalHelper(){ return true; }');
  assert.throws(()=>removeLegacyGoalsSource(malformed),/unexpected helper/);
});

test('retirement cleanup removes exactly renderGoals and is idempotent',()=>{
  const source=indexFixture();
  const cleaned=removeRenderGoalsRetirementEntry(source);
  assert.equal(cleaned.includes('"renderGoals"'),false);
  assert.equal(cleaned.includes('"renderHistory"'),true);
  assert.equal(removeRenderGoalsRetirementEntry(cleaned),cleaned);
});

test('current shell and retirement registry are atomically staged or retired',()=>{
  const shellChanged=removeLegacyGoalsSource(shell)!==shell;
  const indexChanged=removeRenderGoalsRetirementEntry(index)!==index;
  assert.equal(shellChanged,indexChanged,'shell source and retirement registry must change together');

  if(!shellChanged){
    assert.equal(/\bfunction\s+renderGoals\s*\(/.test(shell),false,'retired shell must not contain renderGoals');
    assert.equal(index.includes('"renderGoals"'),false,'retired registry must not contain renderGoals');
  }
});