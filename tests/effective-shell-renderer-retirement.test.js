const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');
const ariseV3=fs.readFileSync('arise-v3.js','utf8');
const analyticsUi=fs.readFileSync('analytics-ui.js','utf8');
const settingsUi=fs.readFileSync('settings-ui.js','utf8');

const canonical=['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics','renderSettings'];

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

test('all primary legacy renderers are physically absent from the compatibility shell',()=>{
  for(const name of canonical){
    assert.equal(sourceHas(name),false,`${name} must stay physically removed from app-shell.html`);
  }
});

test('production bootstrap no longer carries renderer retirement machinery',()=>{
  assert.doesNotMatch(index,/LEGACY_RENDERER_RETIREMENT/);
  assert.doesNotMatch(index,/retireLegacyRenderer/);
  assert.doesNotMatch(index,/retireLegacyRenderers/);
  assert.doesNotMatch(index,/renderer boundary not found/);
  assert.doesNotMatch(index,/renderer end boundary not found/);
});

test('physical renderer retirement cannot regress without violating canonical ownership contract',()=>{
  for(const name of canonical){
    assert.equal(sourceHas(name),false,`${name} must not return to compatibility source`);
  }
  assert.match(index,/\.\/arise-v3\.js/);
  assert.match(index,/\.\/analytics-ui\.js/);
  assert.match(index,/\.\/settings-ui\.js/);
});
