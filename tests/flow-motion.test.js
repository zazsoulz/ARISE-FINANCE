const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const source=fs.readFileSync('arise-v3.js','utf8');
const css=fs.readFileSync('product-ui.css','utf8');

function pos(value){return index.indexOf(value);}

test('home flow stays inside the canonical runtime and style surface',()=>{
  const base=pos('./arise-v3.css');
  const analytics=pos('./analytics-ui.css');
  const product=pos('./product-ui.css');
  assert.ok(base>=0,'arise-v3.css missing');
  assert.ok(analytics>base,'analytics styles must load after the A1-V3 base');
  assert.ok(product>analytics,'product styles must remain the final canonical layer');
  assert.equal(pos('./flow-motion.css'),-1,'retired keyframe motion layer returned to production');
  assert.equal(fs.existsSync('flow-motion.css'),false,'retired keyframe motion layer returned to the repository');
});

test('route-following rails and particles are physically absent from home markup',()=>{
  assert.match(source,/return '<canvas class="arise-flow-canvas" aria-hidden="true"><\/canvas>'/);
  for(const token of ['class="arise-flow-svg"','class="arise-flow-branch"','class="arise-flow-drift"','class="arise-flow-particles"','class="arise-flow-source"']){
    assert.equal(source.includes(token),false,token+' returned to home markup');
  }
});

test('reference-preserving material advection owns home motion',()=>{
  assert.match(source,/const HOME_FLOW_TEXTURE_ASPECT=720\/1279/);
  assert.match(source,/uniform sampler2D uFlowTexture/);
  assert.match(source,/function startReferenceHomeFlow\(canvas,image,reducedMotion\)/);
  assert.match(source,/gl\.texImage2D\(gl\.TEXTURE_2D,0,gl\.RGBA,gl\.RGBA,gl\.UNSIGNED_BYTE,image\)/);
  assert.match(source,/vec2 primaryUv=mix\(uv\+bodyWarp,poolUv,poolGate\)/);
  assert.match(source,/vec2 layerAUv=primaryUv/);
  assert.match(source,/vec2 layerBUv=primaryUv/);
  assert.match(source,/vec2 layerCUv=primaryUv/);
  assert.match(source,/mat2\(cs,-sn,sn,cs\)\*poolPoint/);
  assert.match(source,/float travelling=/);
  assert.match(source,/gl\.drawArrays\(gl\.TRIANGLE_STRIP,0,4\)/);
  assert.match(source,/canvas\.dataset\.flowRenderer="reference-advection-webgl"/);
  assert.doesNotMatch(source,/gl\.drawArrays\(gl\.LINES/);
  assert.doesNotMatch(source,/gl\.drawArrays\(gl\.POINTS/);
  assert.doesNotMatch(source,/startWebGLHomeFlow/);
  assert.match(source,/Math\.min\(1\/30,/);
  assert.match(source,/requestAnimationFrame\(draw\)/);
  assert.match(css,/\.arise-flow-canvas\{/);
  assert.match(css,/--arise-flow-guide:url\("\.\/assets\/arise-flow-organic-v3\.webp"\)/);
});

test('fluid renderer has a safe static fallback and reduced-motion frame',()=>{
  assert.match(source,/canvas\.dataset\.flowRenderer="static"/);
  assert.match(source,/if\(reducedMotion\)\{[\s\S]*?canvas\.dataset\.flowMotion="reduced"/);
  assert.match(css,/\.arise-flow-canvas\.is-static\{[\s\S]*?background:var\(--arise-flow-guide\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?\.arise-flow-canvas\{[\s\S]*?transform:none!important/);
});
