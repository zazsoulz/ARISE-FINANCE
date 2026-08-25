const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const productCss=fs.readFileSync("product-ui.css","utf8");
const v3Source=fs.readFileSync("arise-v3.js","utf8");
const analyticsSource=fs.readFileSync("analytics-ui.js","utf8");
const authSource=fs.readFileSync("auth-ui.js","utf8");
const productSource=fs.readFileSync("product-ui.js","utf8");

test("home uses a continuous material flow without route rails",()=>{
  assert.match(v3Source,/function homeFlowScene\(\)/);
  assert.match(v3Source,/class="arise-flow-canvas"/);
  assert.match(v3Source,/function startHomeFluidFlow\(canvas\)/);
  assert.match(v3Source,/requestAnimationFrame\(draw\)/);
  assert.match(v3Source,/const HOME_FLOW_BODY_SHEETS=32/);
  assert.match(v3Source,/const HOME_FLOW_BODY_FILAMENTS=100/);
  assert.match(v3Source,/const HOME_FLOW_LANDING_STREAMS=28/);
  assert.match(v3Source,/const HOME_FLOW_POOL_RINGS=34/);
  assert.match(v3Source,/const HOME_FLOW_LANDING_PARTICLES=800/);
  assert.match(v3Source,/function createHomeFlowRibbonGeometry\(\)/);
  assert.match(v3Source,/function createHomeFlowParticleGeometry\(\)/);
  assert.match(v3Source,/function startProcedural3DHomeFlow\(canvas,reducedMotion\)/);
  assert.match(v3Source,/vec3 bodyPosition\(float progress,float lane,float depth,float seed\)/);
  assert.match(v3Source,/vec3 landingPosition\(float progress,float reachSeed,float depth,float seed\)/);
  assert.match(v3Source,/vec3 poolPosition\(float progress,float radiusSeed,float depth,float seed,float kind\)/);
  assert.match(v3Source,/float y=0\.906\+sin\(angle\)\*radius\*0\.118/);
  assert.match(v3Source,/float endY=0\.906\+sin\(angle\)\*radius\*0\.118/);
  assert.match(v3Source,/gl\.drawArrays\(gl\.TRIANGLES,0,ribbonData\.length\/8\)/);
  assert.match(v3Source,/gl\.drawArrays\(gl\.POINTS,0,particleData\.length\/8\)/);
  assert.match(v3Source,/canvas\.dataset\.flowRenderer="procedural-3d-webgl"/);
  assert.doesNotMatch(v3Source,/sampler2D/);
  assert.doesNotMatch(v3Source,/texture2D\(/);
  assert.doesNotMatch(v3Source,/texImage2D\(/);
  assert.doesNotMatch(v3Source,/new root\.Image\(\)/);
  assert.doesNotMatch(v3Source,/gl\.drawArrays\(gl\.LINES/);
  assert.match(v3Source,/Math\.min\(1\/30,/);
  assert.doesNotMatch(v3Source,/class="arise-flow-svg"/);
  assert.doesNotMatch(v3Source,/class="arise-flow-branch"/);
  assert.doesNotMatch(v3Source,/class="arise-flow-drift"/);
  assert.doesNotMatch(v3Source,/class="arise-flow-particles"/);
  assert.doesNotMatch(v3Source,/class="arise-flow-source"/);
  assert.match(productCss,/ARISE CONTINUOUS HOME FLOW/);
  assert.match(productCss,/\.arise-flow-node::before\{[\s\S]*?content:none!important;[\s\S]*?display:none!important/);
  assert.match(productCss,/--arise-flow-guide:url\("\.\/assets\/arise-flow-organic-v3\.webp"\)/);
  assert.match(productCss,/\.arise-remainder::before,[\s\S]*?\.arise-remainder::after\{[\s\S]*?content:none!important/);
  assert.match(v3Source,/canvas\.dataset\.flowRenderer="static"/);
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
