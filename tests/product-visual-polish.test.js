const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const productCss=fs.readFileSync("product-ui.css","utf8");
const v3Source=fs.readFileSync("arise-v3.js","utf8");
const particleSource=fs.readFileSync("home-particle-matter.js","utf8");
const analyticsSource=fs.readFileSync("analytics-ui.js","utf8");
const authSource=fs.readFileSync("auth-ui.js","utf8");
const productSource=fs.readFileSync("product-ui.js","utf8");

test("home uses one continuous unified particle flow without route rails or legacy texture runtime",()=>{
  assert.match(v3Source,/function homeFlowScene\(\)/);
  assert.match(v3Source,/class="arise-flow-canvas"/);
  assert.match(particleSource,/function startUnifiedParticleMatter\(canvas\)/);
  assert.match(particleSource,/createParticlePopulation\(compact\?1280:2200\)/);
  assert.match(particleSource,/dataset\.flowArchitecture="unified-particle-matter"/);
  assert.match(particleSource,/dataset\.flowPopulationOwner="home-particle-matter"/);
  assert.match(particleSource,/requestAnimationFrame\(draw\)/);
  assert.match(particleSource,/Math\.min\(1\/30,/);
  for(const legacyToken of [
    "startHomeFluidFlow",
    "homeFlowVertexShader",
    "homeFlowFragmentShader",
    "parseFlowTexture",
    "startWebGLHomeFlow",
    "startCanvasHomeFlow"
  ])assert.equal(v3Source.includes(legacyToken),false,`${legacyToken} must stay physically retired from arise-v3.js`);
  assert.doesNotMatch(v3Source,/class="arise-flow-svg"/);
  assert.doesNotMatch(v3Source,/class="arise-flow-branch"/);
  assert.doesNotMatch(v3Source,/class="arise-flow-drift"/);
  assert.doesNotMatch(v3Source,/class="arise-flow-particles"/);
  assert.doesNotMatch(v3Source,/class="arise-flow-source"/);
  assert.match(productCss,/ARISE CONTINUOUS HOME FLOW/);
  assert.match(productCss,/\.arise-flow-node::before\{[\s\S]*?content:none!important;[\s\S]*?display:none!important/);
  assert.match(v3Source,/class="v3-summary-particles"/);
  for(const kind of ["fixed","categories","reserve","goals"]){
    assert.ok(v3Source.includes(`kind:"${kind}"`),`${kind} flow destination is missing`);
  }
});

test("analytics finishing preserves data-backed charts while adding depth",()=>{
  assert.match(analyticsSource,/function area\(values/);
  assert.match(analyticsSource,/function monotonePath\(points\)/);
  assert.match(analyticsSource,/class="analytics-area income-area"/);
  assert.match(analyticsSource,/class="analytics-area expense-area"/);
  assert.match(analyticsSource,/class="analytics-y-scale"/);
  assert.match(analyticsSource,/--kpi-ratio:/);
  assert.match(analyticsSource,/pathLength="1"/);
  assert.match(analyticsSource,/analytics-reserve-satellite/);
  assert.match(analyticsSource,/analytics\.monthly\(profile,currentMonth\)/);
});

test("history, goals and reserve use the calibrated data-visualization language",()=>{
  assert.match(v3Source,/function monotoneChartPath\(points\)/);
  assert.match(v3Source,/class="v3-chart-y-scale"/);
  assert.match(v3Source,/class="v3-chart-change/);
  assert.match(v3Source,/class="goal-ring-terminal"/);
  assert.match(productCss,/ARISE DATA & TYPE CALIBRATION/);
  assert.match(productCss,/--arise-weight-number:325/);
  assert.match(productCss,/\.analytics-terminal-guide,/);
  assert.match(productCss,/\.analytics-reserve-center small/);
});

test("secondary screens use one measurable route instead of decorative card polish",()=>{
  for(const token of [
    "v3-head-status",
    "v3-summary-measure",
    "v3-goals-overview",
    "v3-goal-track",
    "v3-break-signal",
    "analytics-kpi-band",
    "analytics-chart-readout"
  ])assert.ok(v3Source.includes(token)||analyticsSource.includes(token)||productCss.includes(`.${token}`),`${token} is missing`);
  assert.match(v3Source,/function bindHistoryChart\(scope\)/);
  assert.match(analyticsSource,/function bindPulseChart\(scope\)/);
  assert.match(analyticsSource,/class="analytics-chart-hit"/);
});

test("auth and settings use the same product-level visual vocabulary",()=>{
  assert.match(authSource,/class="login-visual"/);
  assert.match(authSource,/class="login-flow-particles"/);
  assert.match(authSource,/class="login-shell"/);
  assert.match(authSource,/class="login-assurance"/);
  assert.match(productSource,/function decorateSettings\(page\)/);
  assert.match(productSource,/\["#canonicalAccountName","profile","account"\]/);
  assert.match(productSource,/settings-card-mark/);
});

test("finishing layer covers motion, surfaces and reduced-motion safety",()=>{
  assert.match(productCss,/ARISE PRODUCT FINISHING LAYER/);
  for(const token of [
    "ariseAmbientDrift",
    "arisePageFinish",
    ".arise-flow-sheets",
    ".analytics-kpi-aura",
    ".settings-card-mark",
    ".login-flow"
  ])assert.ok(productCss.includes(token),`${token} is missing from the finishing layer`);
  assert.match(productCss,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.arise-flow-particles,[\s\S]*?\.v3-summary-particles,[\s\S]*?\.login-flow-particles\{[\s\S]*?display:none!important/);
});

test("final art direction uses the approved type and organic flow assets",()=>{
  assert.match(productCss,/ARISE FINAL ART-DIRECTION CORRECTION/);
  assert.match(productCss,/@font-face\{[\s\S]*?font-family:"ARISE Manrope"/);
  assert.match(productCss,/arise-flow-organic-v3\.webp/);
  assert.match(productCss,/\.product-nav\{[\s\S]*?left:50%!important;[\s\S]*?translateX\(-50%\)!important/);
  assert.match(productCss,/\.v3-flow-summary\{[\s\S]*?background:transparent!important/);
  assert.match(productCss,/\.settings-index\{/);
  assert.ok(fs.existsSync("assets/fonts/Manrope-Variable.ttf"));
  assert.ok(fs.existsSync("assets/arise-flow-organic-v3.webp"));
});
