const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const shell=fs.readFileSync('app-shell.html','utf8');
const loader=fs.readFileSync('index.html','utf8');
const ariseV3=fs.readFileSync('arise-v3.js','utf8');

const ownership=[
  {
    name:'renderTopbar',
    legacy:/function\s+renderTopbar\s*\(/,
    canonical:/root\.renderTopbar\s*=\s*function\s*\(/,
    owner:'arise-v3.js'
  },
  {
    name:'renderNav',
    legacy:/function\s+renderNav\s*\(/,
    canonical:/root\.renderNav\s*=\s*function\s*\(/,
    owner:'arise-v3.js'
  },
  {
    name:'renderHome',
    legacy:/function\s+renderHome\s*\(/,
    canonical:/root\.renderHome\s*=\s*function\s*\(/,
    owner:'arise-v3.js'
  }
];

test('compatibility shell renderers have explicit canonical owners',()=>{
  for(const entry of ownership){
    assert.match(shell,entry.legacy,`${entry.name} legacy shell definition missing; update ownership map when it is physically retired`);
    assert.match(ariseV3,entry.canonical,`${entry.name} is not owned by ${entry.owner}`);
  }
});

test('canonical A1-V3 renderer owner loads before bootstrap',()=>{
  const ownerIndex=loader.indexOf('./arise-v3.js');
  const bootstrapIndex=loader.indexOf('./financial-bootstrap.js');
  assert.ok(ownerIndex>=0,'arise-v3.js missing from production loader');
  assert.ok(bootstrapIndex>ownerIndex,'arise-v3.js must load before financial-bootstrap.js');
});

test('first physical shell retirement candidates stay narrow and auditable',()=>{
  const candidates=ownership.map(entry=>entry.name);
  assert.deepEqual(candidates,['renderTopbar','renderNav','renderHome']);
  assert.equal(new Set(candidates).size,candidates.length);
});
