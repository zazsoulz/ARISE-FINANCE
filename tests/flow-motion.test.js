const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shellSource=fs.readFileSync('arise-v3.js','utf8');
const particleSource=fs.readFileSync('home-particle-matter.js','utf8');
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

test('unified particle matter supersedes the legacy material renderer at runtime',()=>{
  const legacy=pos('./arise-v3.js');
  const particles=pos('./home-particle-matter.js');
  assert.ok(legacy>=0,'arise-v3.js missing');
  assert.ok(particles>legacy,'particle matter must load after the compatibility home renderer');
  assert.match(particleSource,/flowArchitecture="unified-particle-matter"/);
  assert.match(particleSource,/createParticlePopulation/);
  assert.match(particleSource,/sampleParticle/);
  assert.match(particleSource,/suppressLegacyFlowRenderer/,'legacy texture renderer must be suppressed before compatibility render');
  assert.match(particleSource,/--arise-flow-texture:none!important/,'legacy texture input must be disabled during takeover');
  assert.equal(particleSource.includes('oldCanvas.replaceWith(canvas)'),false,'unified renderer must not depend on replacing the canonical canvas');
  assert.equal(particleSource.includes('cloneNode(false)'),false,'unified renderer must reuse the canonical flow canvas');
});

test('route-following rails and independent particle overlays are absent from effective home markup',()=>{
  assert.match(shellSource,/return '<canvas class="arise-flow-canvas" aria-hidden="true"><\/canvas>'/);
  for(const token of ['class="arise-flow-svg"','class="arise-flow-branch"','class="arise-flow-drift"','class="arise-flow-particles"','class="arise-flow-source"']){
    assert.equal(shellSource.includes(token),false,token+' returned to home markup');
  }
  assert.equal(particleSource.includes('ribbon'),false,'particle renderer must not introduce ribbon geometry');
  assert.equal(particleSource.includes('mesh'),false,'particle renderer must not introduce mesh geometry');
  assert.equal(particleSource.includes('uTexture'),false,'particle renderer must not depend on a raster material texture');
  assert.equal(particleSource.includes('texture2D'),false,'particle renderer must not deform a raster material texture');
});

test('one particle population owns dense, sparse, cloud and reservoir states',()=>{
  assert.match(particleSource,/const population=createParticlePopulation/);
  assert.match(particleSource,/for\(const particle of population\)/);
  assert.match(particleSource,/const state=sampleParticle\(particle,time\)/);
  assert.match(particleSource,/const cloud=/);
  assert.match(particleSource,/const reservoir=/);
  assert.match(particleSource,/globalCompositeOperation="lighter"/);
  assert.match(particleSource,/requestAnimationFrame\(draw\)/);
  assert.match(css,/\.arise-flow-canvas\{/);
});

test('particle renderer has a safe static fallback and deterministic reduced-motion frame',()=>{
  assert.match(particleSource,/canvas\.dataset\.flowRenderer="static"/);
  assert.match(particleSource,/reducedMotion\?0\.43:elapsed/);
  assert.match(particleSource,/canvas\.dataset\.flowMotion=reducedMotion\?"reduced":"active"/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?\.arise-flow-canvas\{[\s\S]*?transform:none!important/);
});
