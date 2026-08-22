const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');
const ariseV3=fs.readFileSync('arise-v3.js','utf8');
const analyticsUi=fs.readFileSync('analytics-ui.js','utf8');
const settingsUi=fs.readFileSync('settings-ui.js','utf8');

const navMarker=`/* =========================================================\n   NAV\n========================================================= */`;
const homeMarker=`/* =========================================================\n   HOME\n========================================================= */`;
const goalCardMarker=`/* =========================================================\n   GOAL CARD\n========================================================= */`;
const goalModalMarker=`/* =========================================================\n   GOAL MODAL\n========================================================= */`;
const settingsMarker=`/* =========================================================\n   SETTINGS\n========================================================= */`;
const retired=['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics','renderSettings'];

function retirementRegistry(){
  const match=index.match(/const LEGACY_RENDERER_RETIREMENT=\[([\s\S]*?)\n  \];/);
  assert.ok(match,'central retirement registry missing');
  return match[1];
}

test('production loader retires canonical screen duplicates from the effective compatibility shell',()=>{
  for(const name of retired){
    assert.match(shell,new RegExp(`function\\s+${name}\\s*\\(`),`source compatibility shell should still contain ${name} until physical source retirement`);
  }
  assert.match(index,/function\s+retireLegacyRenderer\s*\(/,'loader retirement helper missing');
  assert.match(index,/function\s+retireLegacyRenderers\s*\(/,'central retirement pass missing');
  assert.match(index,/html=retireLegacyRenderers\(html\);/,'loader must apply the central retirement pass');
  const registry=retirementRegistry();
  for(const name of retired) assert.match(registry,new RegExp(`\\["${name}"`),`${name} retirement missing from registry`);
  for(const name of ['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory']) assert.match(ariseV3,new RegExp(`root\\.${name}\\s*=\\s*function\\s*\\(`));
  assert.match(analyticsUi,/root\.renderAnalytics\s*=\s*function\s*\(/);
  assert.match(settingsUi,/root\.renderSettings\s*=\s*renderSettings/);
});

test('renderer retirement helper fails closed when a compatibility boundary drifts',()=>{
  assert.match(index,/renderer boundary not found/);
  assert.match(index,/renderer end boundary not found/);
  const checks=[
    ['renderTopbar',navMarker],['renderNav',homeMarker],['renderHome',goalCardMarker],['renderIncome','function incomeRow(tx){'],
    ['renderGoals',goalModalMarker],['renderHistory','function historyTransaction(tx){'],['renderAnalytics',settingsMarker],['renderSettings','function categoryEditor(category){']
  ];
  for(const [name,next] of checks){
    const start=shell.indexOf(`function ${name}(){`),end=shell.indexOf(next,start);
    assert.ok(start>=0,`legacy ${name} missing before source retirement`);
    assert.ok(end>start,`${name} retirement boundary drifted`);
  }
});

test('all canonical shell screen duplicates are retired in staged compatibility cleanup',()=>{
  const registry=retirementRegistry();
  const names=[...registry.matchAll(/\["(render[A-Za-z]+)"/g)].map(match=>match[1]);
  assert.deepEqual(names,retired);
  assert.equal((index.match(/html=retireLegacyRenderers\(html\);/g)||[]).length,1,'central retirement pass should execute exactly once');
});
