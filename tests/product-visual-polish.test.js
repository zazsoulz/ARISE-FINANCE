const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const productCss=fs.readFileSync("product-ui.css","utf8");
const v3Source=fs.readFileSync("arise-v3.js","utf8");
const analyticsSource=fs.readFileSync("analytics-ui.js","utf8");
const authSource=fs.readFileSync("auth-ui.js","utf8");
const productSource=fs.readFileSync("product-ui.js","utf8");

test("home and distribution share the organic animated flow language",()=>{
  assert.match(v3Source,/function homeFlowScene\(\)/);
  assert.match(v3Source,/class="arise-flow-sheets"/);
  assert.match(v3Source,/class="arise-flow-contours"/);
  assert.match(v3Source,/class="arise-flow-particles"/);
  assert.match(v3Source,/class="v3-summary-particles"/);
  assert.ok((v3Source.match(/animateMotion/g)||[]).length>=2,"flow scenes must include moving particles");
  for(const kind of ["fixed","categories","reserve","goals"]){
    assert.ok(v3Source.includes(`kind:"${kind}"`),`${kind} flow destination is missing`);
  }
});

test("analytics finishing preserves data-backed charts while adding depth",()=>{
  assert.match(analyticsSource,/function area\(values/);
  assert.match(analyticsSource,/class="analytics-area income-area"/);
  assert.match(analyticsSource,/class="analytics-area expense-area"/);
  assert.match(analyticsSource,/pathLength="1"/);
  assert.match(analyticsSource,/analytics-reserve-satellite/);
  assert.match(analyticsSource,/analytics\.monthly\(profile,currentMonth\)/);
});

test("auth and settings use the same product-level visual vocabulary",()=>{
  assert.match(authSource,/class="login-visual"/);
  assert.match(authSource,/class="login-flow-particles"/);
  assert.match(authSource,/class="login-shell"/);
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
