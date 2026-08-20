const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('app-shell.html','utf8');

const financialMarker=`/* =========================================================\n   FINANCIAL ENGINE\n========================================================= */`;
const uiMarker=`/* =========================================================\n   UI\n========================================================= */`;
const initMarker=`/* =========================================================\n   INITIALIZATION\n========================================================= */`;

function stripLegacyFinancialRuntime(source){
  const financialStart=source.indexOf(financialMarker);
  const uiStart=source.indexOf(uiMarker);
  assert.ok(financialStart>=0);
  assert.ok(uiStart>financialStart);
  let html=source.slice(0,financialStart)+source.slice(uiStart);
  const scriptClose='</scr'+'ipt>';
  const initStart=html.indexOf(initMarker);
  const scriptEnd=html.lastIndexOf(scriptClose);
  assert.ok(initStart>=0);
  assert.ok(scriptEnd>initStart);
  html=html.slice(0,initStart)+html.slice(scriptEnd);
  return html;
}

test('shell boundaries required by the loader still exist',()=>{
  const financial=shell.indexOf(financialMarker);
  const ui=shell.indexOf(uiMarker);
  const init=shell.indexOf(initMarker);
  assert.ok(financial>=0,'financial marker missing');
  assert.ok(ui>financial,'UI marker must follow financial marker');
  assert.ok(init>ui,'initialization marker must follow UI');
});

test('loader wires financial, analytics, history, product UI, sync and A1-V3 layers in safe order',()=>{
  const core=index.indexOf('./financial-core.js');
  const runtime=index.indexOf('./financial-runtime.js');
  const integration=index.indexOf('./financial-integration.js');
  const reserveAnalytics=index.indexOf('./reserve-analytics.js');
  const analytics=index.indexOf('./analytics-engine.js');
  const productRules=index.indexOf('./product-rules.js');
  const v3=index.indexOf('./arise-v3.js');
  const history=index.indexOf('./history-inspector.js');
  const analyticsUi=index.indexOf('./analytics-ui.js');
  const supabase=index.indexOf('./supabase-client.js');
  const outbox=index.indexOf('./sync-outbox.js');
  const localStore=index.indexOf('./local-account-store.js');
  const syncEngine=index.indexOf('./sync-engine.js');
  const productUi=index.indexOf('./product-ui.js');
  const bootstrap=index.indexOf('./financial-bootstrap.js');
  assert.ok(core>=0);
  assert.ok(runtime>core);
  assert.ok(integration>runtime);
  assert.ok(reserveAnalytics>integration);
  assert.ok(analytics>reserveAnalytics,'analytics must consume financial/reserve core only');
  assert.ok(productRules>analytics);
  assert.ok(v3>productRules);
  assert.ok(history>v3,'history inspector must wrap the final A1-V3 history renderer');
  assert.ok(analyticsUi>history);
  assert.ok(supabase>v3);
  assert.ok(outbox>supabase);
  assert.ok(localStore>outbox,'outbox must exist before local save hooks');
  assert.ok(syncEngine>localStore,'sync engine must see local account storage');
  assert.ok(productUi>syncEngine,'product UI must decorate the already-loaded sync and history layers');
  assert.ok(bootstrap>productUi);
  assert.ok(index.includes('./arise-v3.css'));
  assert.ok(index.includes('./history-inspector.css'));
  assert.ok(index.includes('./product-ui.css'));
});

test('index inline bootstrap JavaScript parses',()=>{
  const match=index.match(/<script>\s*([\s\S]*?)<\/script>/i);
  assert.ok(match,'inline loader script missing');
  assert.doesNotThrow(()=>new Function(match[1]));
});

test('runtime files exist',()=>{
  for(const path of ['currency-engine.js','financial-core.js','financial-runtime.js','financial-integration.js','reserve-analytics.js','analytics-engine.js','product-rules.js','arise-v3.js','arise-v3.css','history-inspector.js','history-inspector.css','product-ui.js','product-ui.css','sync-outbox.js','local-account-store.js','sync-engine.js','financial-bootstrap.js']){
    assert.equal(fs.existsSync(path),true,path+' missing');
  }
});

test('effective shell contains no legacy financial engine or eager initialization',()=>{
  const effective=stripLegacyFinancialRuntime(shell);
  assert.equal(effective.includes('function calculateIncomePlan('),false);
  assert.equal(effective.includes('function validatePlan('),false);
  assert.equal(effective.includes('function createIncomeTransaction('),false);
  assert.equal(effective.includes('function monthStats('),false);
  assert.equal(effective.includes('function goalRemaining('),false);
  assert.equal(effective.includes(initMarker),false);
  assert.equal(effective.includes(uiMarker),true);
});
