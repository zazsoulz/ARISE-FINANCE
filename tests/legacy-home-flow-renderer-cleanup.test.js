const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cleanup=require('../scripts/remove-legacy-home-flow-renderer.js');

const SOURCE_PATH=path.join(__dirname,'..','arise-v3.js');

test('legacy texture/WebGL home-flow renderer can be physically retired without changing canonical screen ownership',()=>{
  const source=fs.readFileSync(SOURCE_PATH,'utf8');
  const transformed=cleanup.transform(source);

  assert.ok(transformed.length<source.length-5000,'cleanup should remove the legacy renderer implementation, not merely disable it');
  for(const token of cleanup.LEGACY_TOKENS){
    assert.equal(transformed.includes(token),false,`${token} must be physically absent after cleanup`);
  }
  assert.equal(transformed.includes(cleanup.START_CALL),false,'legacy home-flow startup call must be removed');
  assert.equal(transformed.includes('  function homeFlowScene(){'),true,'canonical canvas scene must remain');
  assert.equal(transformed.includes('  root.renderHome=function(){'),true,'canonical home screen owner must remain');
  assert.equal(transformed.includes('    bindPageLinks(page);'),true,'home interactions must remain bound');
  assert.doesNotThrow(()=>new Function(transformed),'transformed arise-v3.js must remain valid JavaScript');
});

test('legacy home-flow cleanup is idempotent once physical retirement is complete',()=>{
  const source=fs.readFileSync(SOURCE_PATH,'utf8');
  const transformed=cleanup.transform(source);
  assert.equal(cleanup.transform(transformed),transformed);
});

test('cleanup fails closed on partial legacy renderer state',()=>{
  const source=fs.readFileSync(SOURCE_PATH,'utf8');
  const malformed=source.replace('  function startCanvasHomeFlow(canvas,image,reducedMotion){','  function renamedLegacyFallback(canvas,image,reducedMotion){');
  assert.throws(()=>cleanup.transform(malformed),/Partial legacy home-flow renderer detected/);
});

test('cleanup fails closed when canonical home ownership is ambiguous',()=>{
  const source=fs.readFileSync(SOURCE_PATH,'utf8');
  const ambiguous=source.replace('  root.renderHome=function(){','  root.renderHome=function(){\n  root.renderHome=function(){');
  assert.throws(()=>cleanup.transform(ambiguous),/exactly one canonical renderHome owner/);
});
