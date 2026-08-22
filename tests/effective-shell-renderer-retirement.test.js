const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');
const ariseV3=fs.readFileSync('arise-v3.js','utf8');
const analyticsUi=fs.readFileSync('analytics-ui.js','utf8');

const navMarker=`/* =========================================================\n   NAV\n========================================================= */`;
const homeMarker=`/* =========================================================\n   HOME\n========================================================= */`;
const goalCardMarker=`/* =========================================================\n   GOAL CARD\n========================================================= */`;
const goalModalMarker=`/* =========================================================\n   GOAL MODAL\n========================================================= */`;
const settingsMarker=`/* =========================================================\n   SETTINGS\n========================================================= */`;

test('production loader retires canonical screen duplicates from the effective compatibility shell',()=>{
  for(const name of ['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics']){
    assert.match(shell,new RegExp(`function\\s+${name}\\s*\\(`),`source compatibility shell should still contain ${name} until physical source retirement`);
  }
  assert.match(index,/function\s+retireLegacyRenderer\s*\(/,'loader retirement helper missing');
  assert.equal(index.includes('retireLegacyRenderer(html,"renderTopbar",`/* =========================================================\\n   NAV\\n========================================================= */`)'),true,'renderTopbar is not retired before canonical runtime boot');
  assert.equal(index.includes('retireLegacyRenderer(html,"renderNav",`/* =========================================================\\n   HOME\\n========================================================= */`)'),true,'renderNav is not retired before canonical runtime boot');
  assert.equal(index.includes('retireLegacyRenderer(html,"renderHome",`/* =========================================================\\n   GOAL CARD\\n========================================================= */`)'),true,'renderHome is not retired before canonical runtime boot');
  assert.equal(index.includes('retireLegacyRenderer(html,"renderIncome","function incomeRow(tx){")'),true,'renderIncome is not retired before canonical runtime boot');
  assert.equal(index.includes('retireLegacyRenderer(html,"renderGoals",`/* =========================================================\\n   GOAL MODAL\\n========================================================= */`)'),true,'renderGoals is not retired before canonical runtime boot');
  assert.equal(index.includes('retireLegacyRenderer(html,"renderHistory","function historyTransaction(tx){")'),true,'renderHistory is not retired before canonical runtime boot');
  assert.equal(index.includes('retireLegacyRenderer(html,"renderAnalytics",`/* =========================================================\\n   SETTINGS\\n========================================================= */`)'),true,'renderAnalytics is not retired before canonical runtime boot');
  for(const name of ['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory']){
    assert.match(ariseV3,new RegExp(`root\\.${name}\\s*=\\s*function\\s*\\(`),`canonical ${name} owner missing`);
  }
  assert.match(analyticsUi,/root\.renderAnalytics\s*=\s*function\s*\(/,'canonical renderAnalytics owner missing from analytics-ui');
});

test('renderer retirement helper fails closed when a compatibility boundary drifts',()=>{
  assert.match(index,/renderer boundary not found/);
  assert.match(index,/renderer end boundary not found/);
  const topbarStart=shell.indexOf('function renderTopbar(){');
  const followingNav=shell.indexOf(navMarker,topbarStart);
  assert.ok(topbarStart>=0,'legacy topbar missing before source retirement');
  assert.ok(followingNav>topbarStart,'topbar/nav boundary order drifted');
  const navStart=shell.indexOf('function renderNav(){');
  const followingHome=shell.indexOf(homeMarker,navStart);
  assert.ok(navStart>=0,'legacy nav missing before source retirement');
  assert.ok(followingHome>navStart,'nav/home boundary order drifted');
  const homeStart=shell.indexOf('function renderHome(){');
  const followingGoalCard=shell.indexOf(goalCardMarker,homeStart);
  assert.ok(homeStart>=0,'legacy home missing before source retirement');
  assert.ok(followingGoalCard>homeStart,'home/goal-card boundary order drifted');
  const incomeStart=shell.indexOf('function renderIncome(){');
  const followingIncomeRow=shell.indexOf('function incomeRow(tx){',incomeStart);
  assert.ok(incomeStart>=0,'legacy income missing before source retirement');
  assert.ok(followingIncomeRow>incomeStart,'income/income-row boundary order drifted');
  const goalsStart=shell.indexOf('function renderGoals(){');
  const followingGoalModal=shell.indexOf(goalModalMarker,goalsStart);
  assert.ok(goalsStart>=0,'legacy goals missing before source retirement');
  assert.ok(followingGoalModal>goalsStart,'goals/goal-modal boundary order drifted');
  const historyStart=shell.indexOf('function renderHistory(){');
  const followingHistoryTransaction=shell.indexOf('function historyTransaction(tx){',historyStart);
  assert.ok(historyStart>=0,'legacy history missing before source retirement');
  assert.ok(followingHistoryTransaction>historyStart,'history/history-transaction boundary order drifted');
  const analyticsStart=shell.indexOf('function renderAnalytics(){');
  const followingSettings=shell.indexOf(settingsMarker,analyticsStart);
  assert.ok(analyticsStart>=0,'legacy analytics missing before source retirement');
  assert.ok(followingSettings>analyticsStart,'analytics/settings boundary order drifted');
});

test('all canonical shell screen duplicates are retired in staged compatibility cleanup',()=>{
  const retired=['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics'];
  assert.equal((index.match(/retireLegacyRenderer\(html,/g)||[]).length,retired.length);
  for(const name of retired){
    assert.equal(index.includes(`retireLegacyRenderer(html,"${name}"`),true,`${name} retirement missing`);
  }
  assert.equal(index.includes('retireLegacyRenderer(html,"renderSettings"'),false,'settings is still compatibility-owned and must remain for a separate reviewed step');
});
