const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const shell=fs.readFileSync('app-shell.html','utf8');
const ariseV3=fs.readFileSync('arise-v3.js','utf8');
const analyticsUi=fs.readFileSync('analytics-ui.js','utf8');

const canonical=[
  {name:'renderTopbar',source:ariseV3},
  {name:'renderNav',source:ariseV3},
  {name:'renderHome',source:ariseV3},
  {name:'renderIncome',source:ariseV3},
  {name:'renderGoals',source:ariseV3},
  {name:'renderHistory',source:ariseV3},
  {name:'renderAnalytics',source:analyticsUi}
];

function escaped(name){return name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

test('canonical renderer owners do not capture their own legacy shell implementations',()=>{
  for(const {name,source} of canonical){
    const n=escaped(name);
    const suffix=name.replace(/^render/,'');
    const capturePatterns=[
      new RegExp(`(?:const|let|var)\\s+(?:old|legacy|original)(?:Render)?${suffix}\\s*=\\s*root\\.${n}\\b`,'i'),
      new RegExp(`(?:const|let|var)\\s+(?:old|legacy|original)(?:Render)?${suffix}\\s*=\\s*${n}\\b`,'i')
    ];
    for(const pattern of capturePatterns){
      assert.doesNotMatch(source,pattern,`${name} still captures/delegates to its compatibility-shell implementation`);
    }
  }
});

test('canonical renderer owners define direct replacements while shell duplicates still exist',()=>{
  for(const {name,source} of canonical){
    const n=escaped(name);
    assert.match(shell,new RegExp(`function\\s+${n}\\s*\\(`),`${name} legacy definition unexpectedly disappeared; retire it in a dedicated PR`);
    assert.match(source,new RegExp(`root\\.${n}\\s*=\\s*function\\s*\\(`),`${name} is not a direct canonical replacement`);
  }
});

test('cross-renderer composition stays allowed during staged retirement',()=>{
  assert.match(analyticsUi,/const\s+oldRenderNav\s*=\s*root\.renderNav\b/,'analytics navigation compatibility composition unexpectedly changed');
  assert.doesNotMatch(analyticsUi,/oldRenderAnalytics\s*=\s*root\.renderAnalytics\b/i);
});

test('settings composition is centralized while the legacy base markup remains staged',()=>{
  const accountSettings=fs.readFileSync('account-settings.js','utf8');
  const profileLifecycle=fs.readFileSync('profile-lifecycle.js','utf8');
  const settingsUi=fs.readFileSync('settings-ui.js','utf8');
  assert.match(shell,/function\s+renderSettings\s*\(/);
  assert.doesNotMatch(accountSettings,/root\.renderSettings\s*=/);
  assert.doesNotMatch(profileLifecycle,/root\.renderSettings\s*=/);
  assert.match(settingsUi,/const\s+baseRenderSettings\s*=\s*root\.renderSettings/);
  assert.match(settingsUi,/root\.renderSettings\s*=\s*renderSettings/);
  assert.equal(canonical.some(entry=>entry.name==='renderSettings'),false);
});
