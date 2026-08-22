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

test('canonical renderer owners do not capture legacy shell implementations',()=>{
  for(const {name,source} of canonical){
    const n=escaped(name);
    const capturePatterns=[
      new RegExp(`(?:const|let|var)\\s+\\w+\\s*=\\s*root\\.${n}\\b`),
      new RegExp(`(?:const|let|var)\\s+\\w+\\s*=\\s*${n}\\b`),
      new RegExp(`original(?:Render)?${n.replace(/^render/,'')}\\s*=\\s*root\\.${n}\\b`,'i')
    ];
    for(const pattern of capturePatterns){
      assert.doesNotMatch(source,pattern,`${name} still captures/delegates to the compatibility-shell implementation`);
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

test('settings remains explicitly excluded because account settings still decorates the shell base renderer',()=>{
  const accountSettings=fs.readFileSync('account-settings.js','utf8');
  assert.match(shell,/function\s+renderSettings\s*\(/);
  assert.match(accountSettings,/root\.renderSettings\s*=\s*function\s*\(/);
  assert.equal(canonical.some(entry=>entry.name==='renderSettings'),false);
});
