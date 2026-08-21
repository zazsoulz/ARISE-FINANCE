const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const workflow=fs.readFileSync('.github/workflows/test.yml','utf8');

function runtimeScripts(){
  const start=index.indexOf('const runtime=');
  const end=index.indexOf('const bootHide=',start);
  assert.ok(start>=0,'runtime manifest start missing');
  assert.ok(end>start,'runtime manifest end missing');
  return [...index.slice(start,end).matchAll(/\.\/([a-z0-9-]+\.js)/g)].map(match=>match[1]);
}

test('production runtime manifest contains unique existing local modules',()=>{
  const scripts=runtimeScripts();
  assert.ok(scripts.length>=30,'runtime manifest unexpectedly small');
  assert.equal(new Set(scripts).size,scripts.length,'duplicate local runtime module in production loader');
  for(const file of scripts){
    assert.equal(fs.existsSync(file),true,`${file} is loaded in production but missing from repository`);
  }
});

test('every production local runtime module is covered by the syntax gate',()=>{
  for(const file of runtimeScripts()){
    assert.equal(workflow.includes(`node --check ${file}`),true,`${file} is loaded in production but absent from syntax check`);
  }
});

test('canonical financial bootstrap remains ordered and last among local runtime modules',()=>{
  const scripts=runtimeScripts();
  const position=file=>scripts.indexOf(file);
  assert.ok(position('financial-core.js')>=0);
  assert.ok(position('financial-runtime.js')>position('financial-core.js'));
  assert.ok(position('product-rules.js')>position('financial-runtime.js'));
  assert.ok(position('runtime-integrity.js')>position('product-rules.js'));
  assert.equal(scripts.at(-1),'financial-bootstrap.js');
});
