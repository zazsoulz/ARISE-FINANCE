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
const canonical=['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics','renderSettings'];
const boundaries={
  renderTopbar:navMarker,
  renderNav:homeMarker,
  renderHome:goalCardMarker,
  renderIncome:'function incomeRow(tx){',
  renderGoals:goalModalMarker,
  renderHistory:'function historyTransaction(tx){',
  renderAnalytics:settingsMarker,
  renderSettings:'function categoryEditor(category){'
};

function retirementRegistry(){
  const match=index.match(/const LEGACY_RENDERER_RETIREMENT=\[([\s\S]*?)\n  \];/);
  assert.ok(match,'central retirement registry missing');
  return match[1];
}

function registryNames(){
  return [...retirementRegistry().matchAll(/\["(render[A-Za-z]+)"/g)].map(match=>match[1]);
}

function sourceHas(name){
  return new RegExp(`function\\s+${name}\\s*\\(`).test(shell);
}

test('canonical screen renderers have external owners independent of compatibility source',()=>{
  for(const name of ['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory']){
    assert.match(ariseV3,new RegExp(`root\\.${name}\\s*=\\s*function\\s*\\(`),`${name} canonical owner missing`);
  }
  assert.match(analyticsUi,/root\.renderAnalytics\s*=\s*function\s*\(/,'renderAnalytics canonical owner missing');
  assert.match(settingsUi,/root\.renderSettings\s*=\s*renderSettings/,'renderSettings canonical owner missing');
});

test('only legacy renderers still physically present are retired from the effective compatibility shell',()=>{
  assert.match(index,/function\s+retireLegacyRenderer\s*\(/,'loader retirement helper missing');
  assert.match(index,/function\s+retireLegacyRenderers\s*\(/,'central retirement pass missing');
  assert.match(index,/html=retireLegacyRenderers\(html\);/,'loader must apply the central retirement pass');

  const physicallyPresent=canonical.filter(sourceHas);
  assert.deepEqual(registryNames(),physicallyPresent,'retirement registry must track exactly the legacy renderers that still exist in app-shell.html');
});

test('renderer retirement boundaries fail closed while a legacy renderer still exists',()=>{
  assert.match(index,/renderer boundary not found/);
  assert.match(index,/renderer end boundary not found/);

  for(const name of registryNames()){
    const next=boundaries[name];
    assert.ok(next,`${name} boundary contract missing`);
    const start=shell.indexOf(`function ${name}(){`);
    const end=shell.indexOf(next,start);
    assert.ok(start>=0,`${name} listed for retirement but missing from compatibility source`);
    assert.ok(end>start,`${name} retirement boundary drifted`);
  }
});

test('physical renderer cleanup can proceed without weakening canonical ownership',()=>{
  const names=registryNames();
  assert.equal(new Set(names).size,names.length,'retirement registry contains duplicates');
  assert.ok(names.every(name=>canonical.includes(name)),'retirement registry contains a non-canonical screen renderer');
  assert.equal((index.match(/html=retireLegacyRenderers\(html\);/g)||[]).length,1,'central retirement pass should execute exactly once');

  for(const name of canonical){
    if(sourceHas(name)) assert.ok(names.includes(name),`${name} still exists physically but is not retired at runtime`);
    else assert.ok(!names.includes(name),`${name} was physically removed but remains in the retirement registry`);
  }
});
