const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  HISTORY_MARKER,
  HISTORY_TRANSACTION_BOUNDARY,
  RENDER_HISTORY_RETIREMENT,
  removeLegacyHistorySource,
  removeRenderHistoryRetirementEntry
}=require('../scripts/remove-legacy-history-source.js');

function sampleShell(extra=''){
  return `before\n${HISTORY_MARKER}\nfunction renderHistory(){ return 'legacy'; }\nfunction historyMonthBlock(){ return 'retired-helper'; }\n${extra}${HISTORY_TRANSACTION_BOUNDARY}\n  return 'helper';\n}\nafter`;
}

function sampleIndex(entry=RENDER_HISTORY_RETIREMENT){
  return `before\nconst LEGACY_RENDERER_RETIREMENT=[\n${entry}    ["renderAnalytics","marker"],\n];\nafter`;
}

test('removes retired history renderer block and preserves historyTransaction helper',()=>{
  const result=removeLegacyHistorySource(sampleShell());
  assert.equal(result.includes('function renderHistory(){'),false);
  assert.equal(result.includes('function historyMonthBlock(){'),false);
  assert.equal(result.includes(HISTORY_MARKER),false);
  assert.equal(result.includes(HISTORY_TRANSACTION_BOUNDARY),true);
  assert.equal(result.includes("return 'helper'"),true);
  assert.equal(result.startsWith('before\n'),true);
  assert.equal(result.endsWith('\nafter'),true);
});

test('history source cleanup is idempotent after physical removal',()=>{
  const once=removeLegacyHistorySource(sampleShell());
  assert.equal(removeLegacyHistorySource(once),once);
});

test('refuses malformed history boundaries',()=>{
  assert.throws(
    ()=>removeLegacyHistorySource(`${HISTORY_MARKER}\nfunction renderHistory(){}`),
    /historyTransaction boundary missing/
  );
  assert.throws(
    ()=>removeLegacyHistorySource(`function renderHistory(){}\n${HISTORY_TRANSACTION_BOUNDARY}`),
    /HISTORY boundary missing/
  );
});

test('refuses broad cleanup when an unknown helper appears inside retired block',()=>{
  assert.throws(
    ()=>removeLegacyHistorySource(sampleShell('function accidentalHelper(){}\n')),
    /unexpected helper accidentalHelper/
  );
});

test('removes only matching renderHistory retirement entry',()=>{
  const result=removeRenderHistoryRetirementEntry(sampleIndex());
  assert.equal(result.includes('"renderHistory"'),false);
  assert.equal(result.includes('"renderAnalytics"'),true);
  assert.equal(removeRenderHistoryRetirementEntry(result),result);
});

test('refuses malformed renderHistory retirement entry',()=>{
  const malformed=sampleIndex('    ["renderHistory","wrong-boundary"],\n');
  assert.throws(()=>removeRenderHistoryRetirementEntry(malformed),/retirement entry is malformed/);
});

test('current shell and retirement registry are atomically staged or retired',()=>{
  const shell=fs.readFileSync('app-shell.html','utf8');
  const index=fs.readFileSync('index.html','utf8');
  const cleanedShell=removeLegacyHistorySource(shell);
  const cleanedIndex=removeRenderHistoryRetirementEntry(index);
  const shellChanged=cleanedShell!==shell;
  const indexChanged=cleanedIndex!==index;
  assert.equal(shellChanged,indexChanged,'history shell source and retirement entry must transition atomically');
  assert.equal(cleanedShell.includes('function renderHistory(){'),false,'renderHistory must be removed');
  assert.equal(cleanedShell.includes('function historyMonthBlock('),false,'retired historyMonthBlock helper must be removed with renderer');
  assert.equal(cleanedShell.includes(HISTORY_TRANSACTION_BOUNDARY),true,'historyTransaction compatibility helper must survive cleanup');
  if(!shellChanged){
    assert.equal(index.includes('"renderHistory"'),false,'physically retired renderHistory must stay out of registry');
  }
});