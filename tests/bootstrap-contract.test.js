const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');

const financialMarker=`/* =========================================================\n   FINANCIAL ENGINE\n========================================================= */`;
const uiMarker=`/* =========================================================\n   UI\n========================================================= */`;
const initMarker=`/* =========================================================\n   INITIALIZATION\n========================================================= */`;

test('shell boundaries required by the loader still exist',()=>{
  const financial=shell.indexOf(financialMarker);
  const ui=shell.indexOf(uiMarker);
  const init=shell.indexOf(initMarker);
  assert.ok(financial>=0,'financial marker missing');
  assert.ok(ui>financial,'UI marker must follow financial marker');
  assert.ok(init>ui,'initialization marker must follow UI');
});

test('loader wires the complete financial runtime in order',()=>{
  const core=index.indexOf('./financial-core.js');
  const runtime=index.indexOf('./financial-runtime.js');
  const integration=index.indexOf('./financial-integration.js');
  const bootstrap=index.indexOf('./financial-bootstrap.js');
  assert.ok(core>=0);
  assert.ok(runtime>core);
  assert.ok(integration>runtime);
  assert.ok(bootstrap>integration);
});

test('index inline bootstrap JavaScript parses',()=>{
  const match=index.match(/<script>\s*([\s\S]*?)<\/script>/i);
  assert.ok(match,'inline loader script missing');
  assert.doesNotThrow(()=>new Function(match[1]));
});

test('runtime files exist',()=>{
  for(const path of ['financial-core.js','financial-runtime.js','financial-integration.js','financial-bootstrap.js']){
    assert.equal(fs.existsSync(path),true,path+' missing');
  }
});
