const test=require("node:test");
const assert=require("node:assert/strict");
const {JSDOM,VirtualConsole}=require("jsdom");
const {
  FINANCIAL_MARKER,
  INIT_MARKER,
  buildStandalone
}=require("../scripts/build-standalone-preview.js");

test("standalone preview follows the complete production asset order",()=>{
  const {html,manifest}=buildStandalone();
  const inlineScripts=[...html.matchAll(/<script data-arise-source="([^"]+)">/g)].map(match=>`./${match[1]}`);
  const inlineStyles=[...html.matchAll(/<style data-arise-source="([^"]+)">/g)].map(match=>`./${match[1]}`);
  const localScripts=manifest.scripts.filter(source=>source.startsWith("./"));

  assert.deepEqual(inlineScripts,localScripts);
  assert.deepEqual(inlineStyles,manifest.styles);
  assert.equal(html.includes('<script src="./'),false);
  assert.equal(html.includes('<link rel="stylesheet" href="./'),false);
  assert.ok(html.includes('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'));
  assert.ok(html.indexOf('data-arise-source="runtime-integrity.js"')<html.indexOf('data-arise-source="financial-bootstrap.js"'));
});

test("standalone preview strips the legacy engine and eager shell bootstrap",()=>{
  const {html}=buildStandalone();
  assert.equal(html.includes(FINANCIAL_MARKER),false);
  assert.equal(html.includes(INIT_MARKER),false);
  assert.equal(html.includes("function calculateIncomePlan("),false);
  assert.ok(html.includes("globalThis.__ARISE_LEGACY_FINANCIAL_STRIPPED__=true"));
  assert.ok(html.includes('id="arise-boot-hide"'));
});

test("standalone preview embeds required project-local visual assets without retired raster flow",()=>{
  const {html}=buildStandalone();
  assert.equal(html.includes('url("./assets/'),false);
  assert.ok(html.includes('data:font/ttf;base64,'));
  assert.equal(html.includes('arise-flow-organic-v3.webp'),false);
  assert.equal(html.includes('data:image/webp;base64,'),false);
});

test("standalone preview boots offline into the canonical auth screen",async()=>{
  const {html}=buildStandalone();
  const offlineHtml=html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"><\/script>/,"");
  const virtualConsole=new VirtualConsole();
  const jsdomErrors=[];
  virtualConsole.on("jsdomError",error=>jsdomErrors.push(error));
  const dom=new JSDOM(offlineHtml,{
    url:"https://arise.local/",
    runScripts:"dangerously",
    pretendToBeVisual:true,
    virtualConsole,
    beforeParse(window){window.alert=()=>{};window.confirm=()=>true;}
  });
  await new Promise(resolve=>dom.window.setTimeout(resolve,20));
  assert.ok(dom.window.document.getElementById("authSubmit"));
  assert.ok(dom.window.document.getElementById("authEmail"));
  assert.ok(dom.window.document.getElementById("authPassword"));
  assert.equal(jsdomErrors.length,0);
  assert.equal(dom.window.document.getElementById("arise-boot-hide"),null);
  assert.notEqual(dom.window.document.documentElement.style.visibility,"hidden");
  dom.window.close();
});
