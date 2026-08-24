const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');

const retired=['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics','renderSettings'];

test('legacy screen retirement loader is gone after full physical retirement',()=>{
  assert.doesNotMatch(index,/LEGACY_RENDERER_RETIREMENT/);
  assert.doesNotMatch(index,/retireLegacyRenderer/);
  assert.doesNotMatch(index,/retireLegacyRenderers/);
  assert.doesNotMatch(index,/retireLegacyNavigationConstants/);
});

test('all primary legacy screen renderers stay physically retired',()=>{
  for(const name of retired){
    assert.doesNotMatch(shell,new RegExp(`function\\s+${name}\\s*\\(`));
  }
  assert.doesNotMatch(shell,/\bconst\s+NAV_ITEMS\s*=/);
});

test('shared compatibility helpers remain until their own guarded extraction',()=>{
  assert.match(shell,/function\s+incomeRow\s*\(/,'incomeRow compatibility helper must remain after renderIncome source retirement');
  assert.match(shell,/function\s+showGoalModal\s*\(/,'goal modal lifecycle must remain after renderGoals source retirement');
  assert.match(shell,/function\s+historyTransaction\s*\(/,'historyTransaction compatibility helper must remain after renderHistory source retirement');
  assert.match(shell,/function\s+categoryEditor\s*\(/,'categoryEditor compatibility helper must remain after renderSettings source retirement');
});
