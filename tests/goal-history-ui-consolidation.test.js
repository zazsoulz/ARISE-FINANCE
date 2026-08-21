const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const lifecycle=fs.readFileSync('goal-lifecycle-ui.js','utf8');

test('goal history UI stays consolidated into goal lifecycle UI',()=>{
  assert.equal(fs.existsSync('goal-history-ui.js'),false);
  assert.equal(index.includes('./goal-history-ui.js'),false);
  assert.equal(lifecycle.includes('function showGoalHistory('),true);
  assert.equal(lifecycle.includes('ARISE_GOAL_HISTORY_UI'),true);
  assert.equal(lifecycle.includes('data-goal-history'),true);
});
