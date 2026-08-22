const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const shell=fs.readFileSync('app-shell.html','utf8');
const loader=fs.readFileSync('index.html','utf8');
const ariseV3=fs.readFileSync('arise-v3.js','utf8');
const analyticsUi=fs.readFileSync('analytics-ui.js','utf8');
const accountSettings=fs.readFileSync('account-settings.js','utf8');

const ownership=[
  {name:'renderTopbar',legacy:/function\s+renderTopbar\s*\(/,canonical:/root\.renderTopbar\s*=\s*function\s*\(/,owner:'arise-v3.js',source:ariseV3},
  {name:'renderNav',legacy:/function\s+renderNav\s*\(/,canonical:/root\.renderNav\s*=\s*function\s*\(/,owner:'arise-v3.js',source:ariseV3},
  {name:'renderHome',legacy:/function\s+renderHome\s*\(/,canonical:/root\.renderHome\s*=\s*function\s*\(/,owner:'arise-v3.js',source:ariseV3},
  {name:'renderIncome',legacy:/function\s+renderIncome\s*\(/,canonical:/root\.renderIncome\s*=\s*function\s*\(/,owner:'arise-v3.js',source:ariseV3},
  {name:'renderGoals',legacy:/function\s+renderGoals\s*\(/,canonical:/root\.renderGoals\s*=\s*function\s*\(/,owner:'arise-v3.js',source:ariseV3},
  {name:'renderHistory',legacy:/function\s+renderHistory\s*\(/,canonical:/root\.renderHistory\s*=\s*function\s*\(/,owner:'arise-v3.js',source:ariseV3},
  {name:'renderAnalytics',legacy:/function\s+renderAnalytics\s*\(/,canonical:/root\.renderAnalytics\s*=\s*function\s*\(/,owner:'analytics-ui.js',source:analyticsUi}
];

const decoratedShellRenderers=[
  {name:'renderSettings',legacy:/function\s+renderSettings\s*\(/,decorator:/root\.renderSettings\s*=\s*function\s*\(/,owner:'account-settings.js',source:accountSettings}
];

test('compatibility shell renderers have explicit canonical owners',()=>{
  for(const entry of ownership){
    assert.match(shell,entry.legacy,`${entry.name} legacy shell definition missing; update ownership map when it is physically retired`);
    assert.match(entry.source,entry.canonical,`${entry.name} is not owned by ${entry.owner}`);
  }
});

test('remaining shell-owned renderer decoration is explicit',()=>{
  for(const entry of decoratedShellRenderers){
    assert.match(shell,entry.legacy,`${entry.name} shell base missing`);
    assert.match(entry.source,entry.decorator,`${entry.name} is not decorated by ${entry.owner}`);
  }
});

test('canonical renderer owners load before bootstrap in dependency order',()=>{
  const ariseIndex=loader.indexOf('./arise-v3.js');
  const analyticsIndex=loader.indexOf('./analytics-ui.js');
  const accountIndex=loader.indexOf('./account-settings.js');
  const bootstrapIndex=loader.indexOf('./financial-bootstrap.js');
  assert.ok(ariseIndex>=0,'arise-v3.js missing from production loader');
  assert.ok(analyticsIndex>ariseIndex,'analytics-ui.js must load after arise-v3.js');
  assert.ok(accountIndex>analyticsIndex,'account-settings.js must load after analytics-ui.js');
  assert.ok(bootstrapIndex>accountIndex,'renderer owners must load before financial-bootstrap.js');
});

test('physical shell retirement candidates are complete and auditable',()=>{
  const candidates=ownership.map(entry=>entry.name);
  assert.deepEqual(candidates,['renderTopbar','renderNav','renderHome','renderIncome','renderGoals','renderHistory','renderAnalytics']);
  assert.equal(new Set(candidates).size,candidates.length);
  assert.deepEqual(decoratedShellRenderers.map(entry=>entry.name),['renderSettings']);
});