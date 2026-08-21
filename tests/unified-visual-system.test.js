const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const productCss=fs.readFileSync("product-ui.css","utf8");
const v3Css=fs.readFileSync("arise-v3.css","utf8");
const productUi=fs.readFileSync("product-ui.js","utf8");

test("all five product destinations fit the canonical bottom navigation",()=>{
  assert.match(v3Css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.doesNotMatch(v3Css,/data-page="home"\]::before/);
  assert.match(productCss,/\.product-nav\s*\.product-nav-item::before\{\s*content:none!important/);
  assert.match(productCss,/left:8px!important;\s*right:8px!important;[\s\S]*?width:auto!important;\s*transform:none!important/);
});

test("canonical visual system covers every primary screen family",()=>{
  assert.match(productCss,/ARISE UNIFIED VISUAL SYSTEM/);
  for(const selector of [
    ".arise-v3-home",
    ".v3-flow-summary",
    ".v3-goal",
    ".v3-history-chart",
    ".arise-analytics",
    ".arise-settings",
    ".login-card"
  ])assert.ok(productCss.includes(selector),`${selector} is missing from the unified product layer`);
  assert.match(productCss,/\.arise-v3-income-value,[\s\S]*?\.analytics-value,[\s\S]*?font-family:Inter/);
});

test("shared masthead exposes ARISE finance, month and settings identity",()=>{
  assert.match(productUi,/class="logo product-wordmark"/);
  assert.match(productUi,/<span>finance<\/span>/);
  assert.match(productUi,/class="product-month"/);
  assert.match(productUi,/class="v3-page-head arise-settings-head"/);
});
