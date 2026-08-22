const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const integration=fs.readFileSync('financial-integration.js','utf8');
const bootstrap=fs.readFileSync('financial-bootstrap.js','utf8');
const loader=fs.readFileSync('index.html','utf8');

test('financial integration does not eagerly render before canonical UI owners load',()=>{
  assert.doesNotMatch(integration,/if\(typeof root\.render===\"function\"\) root\.render\(\);/);
  assert.doesNotMatch(integration,/\broot\.render\(\);\s*\n?\}\)\(/);
});

test('financial bootstrap owns the initial app render after canonical UI modules load',()=>{
  assert.match(bootstrap,/if\(state\.account\.registered\) render\(\);\s*\n\s*else renderAuth\(\);/);
  const integrationIndex=loader.indexOf('./financial-integration.js');
  const ariseIndex=loader.indexOf('./arise-v3.js');
  const bootstrapIndex=loader.indexOf('./financial-bootstrap.js');
  assert.ok(integrationIndex>=0&&ariseIndex>integrationIndex&&bootstrapIndex>ariseIndex);
});
