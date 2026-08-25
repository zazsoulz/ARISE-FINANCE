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

test('standalone GPU ribbon field owns home motion',()=>{
  assert.match(source,/const HOME_FLOW_BODY_SHEETS=56/);
  assert.match(source,/const HOME_FLOW_BODY_FILAMENTS=64/);
  assert.match(source,/const HOME_FLOW_LANDING_STREAMS=32/);
  assert.match(source,/const HOME_FLOW_POOL_RINGS=28/);
  assert.match(source,/const HOME_FLOW_POOL_SPIRALS=44/);
  assert.match(source,/const HOME_FLOW_LANDING_PARTICLES=800/);
  assert.match(source,/function createHomeFlowRibbonGeometry\(\)/);
  assert.match(source,/function createHomeFlowParticleGeometry\(\)/);
  assert.match(source,/function startProcedural3DHomeFlow\(canvas,reducedMotion\)/);
  assert.match(source,/vec3 bodyPosition\(float progress,float lane,float depth,float seed\)/);
  assert.match(source,/vec3 landingPosition\(float progress,float reachSeed,float depth,float seed\)/);
  assert.match(source,/vec3 poolPosition\(float progress,float radiusSeed,float depth,float seed,float kind\)/);
  assert.match(source,/float y=0\.906\+sin\(angle\)\*radius\*0\.118/);
  assert.match(source,/float endY=0\.906\+sin\(angle\)\*radius\*0\.118/);
  assert.match(source,/return \{veilData:new Float32Array\(veils\),detailData:new Float32Array\(details\),veilRibbons,detailRibbons\}/);
  assert.match(source,/materialPass:gl\.getUniformLocation\(ribbonProgram,"uMaterialPass"\)/);
  assert.match(source,/gl\.drawArrays\(gl\.TRIANGLES,0,veilData\.length\/8\)/);
  assert.match(source,/gl\.drawArrays\(gl\.TRIANGLES,0,detailData\.length\/8\)/);
  assert.match(source,/gl\.blendFunc\(gl\.SRC_ALPHA,gl\.ONE_MINUS_SRC_ALPHA\)/);
  assert.match(source,/gl\.drawArrays\(gl\.POINTS,0,particleData\.length\/8\)/);
  assert.match(source,/canvas\.dataset\.flowRenderer="procedural-3d-webgl"/);
  assert.doesNotMatch(source,/sampler2D/);
  assert.doesNotMatch(source,/texture2D\(/);
  assert.doesNotMatch(source,/texImage2D\(/);
  assert.doesNotMatch(source,/new root\.Image\(\)/);
  assert.doesNotMatch(source,/gl\.drawArrays\(gl\.LINES/);
  assert.match(source,/Math\.min\(1\/30,/);
  assert.match(source,/requestAnimationFrame\(draw\)/);
  assert.match(css,/\.arise-flow-canvas\{/);
  assert.match(css,/--arise-flow-guide:url\("\.\/assets\/arise-flow-organic-v3\.webp"\)/);
  assert.match(css,/\.arise-remainder::before,[\s\S]*?\.arise-remainder::after\{[\s\S]*?content:none!important/);
  assert.match(css,/@media\(max-width:520px\) and \(max-height:860px\)\{[\s\S]*?\.arise-flow-stage\{[\s\S]*?height:500px!important/);
});

test('fluid renderer has a safe static fallback and reduced-motion frame',()=>{
  assert.match(source,/canvas\.dataset\.flowRenderer="static"/);
  assert.match(source,/if\(reducedMotion\)\{[\s\S]*?canvas\.dataset\.flowMotion="reduced"/);
  assert.match(css,/\.arise-flow-canvas\.is-static\{[\s\S]*?background:var\(--arise-flow-guide\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?\.arise-flow-canvas\{[\s\S]*?transform:none!important/);
});
