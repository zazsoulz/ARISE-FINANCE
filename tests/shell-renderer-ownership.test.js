const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const shell=fs.readFileSync('app-shell.html','utf8');
const loader=fs.readFileSync('index.html','utf8');
const ariseV3=fs.readFileSync('arise-v3.js','utf8');
const analyticsUi=fs.readFileSync('analytics-ui.js','utf8');
const settingsUi=fs.readFileSync('settings-ui.js','utf8');

const ownership=[
  {name:'renderTopbar',legacy:/function\s+renderTopbar\s*\(/,canonical:/root\.renderTopbar\s*=\s*function\s*\(/,owner:'arise-v3.js',source:ariseV3},
  {name:'renderNav',legacy:/function\s+renderNav\s*\(/,canonical:/root\.renderNav\s*=\s*function\s*\(/,owner:'arise-v3.js',source:ariseV3},
  {name:'renderHome',legacy:/function\s+renderHome\s*\(/,canonical:/root\.renderHome\s*=\s*function\s*\(/,owner:'arise-v3.js',source:ariseV3},
  {name:'renderIncome',legacy:/function\s+renderIncome\s*\(/,canonical:/root\.renderIncome\s*=\s*function\s*\(/,owner:'arise-v3.js',source:ariseV3},
  {name:'renderGoals',legacy:/function\s+renderGoals\s*\(/,canonical:/root\.renderGoals\s*=\s*function\s*\(/,owner:'arise-v3.js',source:ariseV3},
  {name:'renderHistory',legacy:/function\s+renderHistory\s*\(/,canonical:/root\.renderHistory\s*=\s*function\s*\(/,owner:'arise-v3.js',source:ariseV3},
  {name:'renderAnalytics',legacy:/function\s+renderAnalytics\s*\(/,canonical:/root\.renderAnalytics\s*=\s*function\s*\(/,owner:'analytics-ui.js',source:analyticsUi},
  {name:'renderSettings',legacy:/function\s+renderSettings\s*\(/,canonical:/root\.renderSettings\s*=\s*renderSettings/,owner:'settings-ui.js',source:settingsUi}
];

test('canonical screen renderers keep explicit external owners after full physical retirement',()=>{
  for(const entry of ownership){
    assert.match(entry.source,entry.canonical,`${entry.name} is not owned by ${entry.owner}`);
    assert.doesNotMatch(shell,entry.legacy,`${entry.name} should stay physically retired`);
  }
  assert.doesNotMatch(shell,/\bconst\s+NAV_ITEMS\s*=/,'legacy navigation item model should stay physically retired with renderNav');
  assert.match(shell,/function\s+incomeRow\s*\(/,'incomeRow must remain while retired income screen source is gone');
  assert.match(shell,/function\s+showGoalModal\s*\(/,'goal modal lifecycle must remain while retired goals screen source is gone');
  assert.match(shell,/function\s+historyTransaction\s*\(/,'historyTransaction must remain while retired history screen source is gone');
  assert.match(shell,/function\s+categoryEditor\s*\(/,'categoryEditor must remain while retired Settings screen source is gone');
});

test('canonical renderer owners load before bootstrap in dependency order',()=>{
  const ariseIndex=loader.indexOf('./arise-v3.js');
  const analyticsIndex=loader.indexOf('./analytics-ui.js');
  const accountIndex=loader.indexOf('./account-settings.js');
  const profileIndex=loader.indexOf('./profile-lifecycle.js');
  const settingsIndex=loader.indexOf('./settings-ui.js');
  const bootstrapIndex=loader.indexOf('./financial-bootstrap.js');
  assert.ok(ariseIndex>=0,'arise-v3.js missing from production loader');
  assert.ok(analyticsIndex>ariseIndex,'analytics-ui.js must load after arise-v3.js');
  assert.ok(accountIndex>analyticsIndex,'account-settings.js must load after analytics-ui.js');
  assert.ok(profileIndex>accountIndex,'profile-lifecycle.js must load after account settings');
  assert.ok(settingsIndex>profileIndex,'settings-ui.js must load after its settings enhancers');
  assert.ok(bootstrapIndex>settingsIndex,'renderer owners must load before financial-bootstrap.js');
});

test('physical shell retirement candidates are complete and auditable',()=>{
  const candidates=ownership.map(entry=>entry.name);
  assert.deepEqual(candidates,['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics','renderSettings']);
  assert.equal(new Set(candidates).size,candidates.length);
  assert.equal(candidates.every(name=>!new RegExp(`function\\s+${name}\\s*\\(`).test(shell)),true);
});
