const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');

const EXPECTED=[];

test('legacy screen renderer retirement registry is empty after full physical retirement',()=>{
  assert.match(index,/const LEGACY_RENDERER_RETIREMENT=\[/);
  assert.match(index,/html=retireLegacyRenderers\(html\);/);

  const registry=index.match(/const LEGACY_RENDERER_RETIREMENT=\[([\s\S]*?)\n  \];/);
  assert.ok(registry,'legacy renderer retirement registry missing');

  const names=[...registry[1].matchAll(/\["(render[A-Za-z]+)"/g)].map(match=>match[1]);
  assert.deepEqual(names,EXPECTED);
});

test('retirement stays fail-closed if a future staged renderer is registered with missing boundaries',()=>{
  assert.match(index,/ARISE shell renderer boundary not found/);
  assert.match(index,/ARISE shell renderer end boundary not found/);
  assert.match(index,/LEGACY_RENDERER_RETIREMENT\.reduce/);
});

test('all primary legacy screen renderers stay out of compatibility source and registry',()=>{
  for(const name of ['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics','renderSettings']){
    assert.doesNotMatch(shell,new RegExp(`function\\s+${name}\\s*\\(`));
    assert.equal(index.includes(`["${name}"`),false,`${name} must not remain in retirement registry after source removal`);
  }
  assert.doesNotMatch(shell,/\bconst\s+NAV_ITEMS\s*=/);
  assert.match(shell,/function\s+incomeRow\s*\(/,'incomeRow compatibility helper must remain after renderIncome source retirement');
  assert.match(shell,/function\s+showGoalModal\s*\(/,'goal modal lifecycle must remain after renderGoals source retirement');
  assert.match(shell,/function\s+historyTransaction\s*\(/,'historyTransaction compatibility helper must remain after renderHistory source retirement');
  assert.match(shell,/function\s+categoryEditor\s*\(/,'categoryEditor compatibility helper must remain after renderSettings source retirement');
});
