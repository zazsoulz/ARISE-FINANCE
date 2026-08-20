const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('analytics-ui.js','utf8');
const css=fs.readFileSync('analytics-ui.css','utf8');
const index=fs.readFileSync('index.html','utf8');

test('analytics screen is wired as a real navigation destination',()=>{
  assert.ok(source.includes('["analytics","Аналитика"]'));
  assert.ok(source.includes('root.renderAnalytics=function()'));
  assert.ok(index.indexOf('./analytics-ui.js')>index.indexOf('./arise-v3.js'));
  assert.ok(index.includes('./analytics-ui.css'));
});

test('analytics visuals consume canonical analytics engine instead of parallel counters',()=>{
  for(const token of [
    'analytics.monthly(profile,currentMonth)',
    'analytics.compare(profile,currentMonth,previousMonth)',
    'analytics.series(profile,6)',
    'analytics.incomeSources(profile,{month})',
    'analytics.goals(profile,new Date())',
    'core.reserveBalance(profile)'
  ]) assert.ok(source.includes(token),token+' missing');
});

test('analytics UI includes custom pulse, source composition, goals and reserve runway visuals',()=>{
  for(const token of ['analytics-pulse','analytics-source-row','analytics-goal-ring','analytics-reserve-orbit','Financial pulse','Расходы вне плана']){
    assert.ok(source.includes(token)||css.includes(token),token+' missing');
  }
});
