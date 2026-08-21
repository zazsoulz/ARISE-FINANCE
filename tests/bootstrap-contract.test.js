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

test('loader wires financial, lifecycle, reconciliation, analytics, product, sync and accessibility layers in safe order',()=>{
  const core=index.indexOf('./financial-core.js');
  const goalLifecycleCore=index.indexOf('./goal-lifecycle-core.js');
  const expenseReconciliation=index.indexOf('./expense-reconciliation.js');
  const runtime=index.indexOf('./financial-runtime.js');
  const integration=index.indexOf('./financial-integration.js');
  const reserveAnalytics=index.indexOf('./reserve-analytics.js');
  const reserveEssential=index.indexOf('./reserve-essential-spend.js');
  const analytics=index.indexOf('./analytics-engine.js');
  const productRules=index.indexOf('./product-rules.js');
  const v3=index.indexOf('./arise-v3.js');
  const reconciliationUi=index.indexOf('./expense-reconciliation-ui.js');
  const history=index.indexOf('./history-inspector.js');
  const analyticsUi=index.indexOf('./analytics-ui.js');
  const supabase=index.indexOf('./supabase-client.js');
  const outbox=index.indexOf('./sync-outbox.js');
  const localStore=index.indexOf('./local-account-store.js');
  const syncEngine=index.indexOf('./sync-engine.js');
  const syncConflictPolicy=index.indexOf('./sync-conflict-policy.js');
  const syncPull=index.indexOf('./sync-pull.js');
  const syncHardening=index.indexOf('./sync-conflict-hardening.js');
  const productUi=index.indexOf('./product-ui.js');
  const reserveLifecycleUi=index.indexOf('./reserve-lifecycle-ui.js');
  const syncConflictUi=index.indexOf('./sync-conflict-ui.js');
  const goalLifecycleUi=index.indexOf('./goal-lifecycle-ui.js');
  const modalAccessibility=index.indexOf('./modal-accessibility.js');
  const bootstrap=index.indexOf('./financial-bootstrap.js');
  assert.ok(core>=0);
  assert.ok(goalLifecycleCore>core,'goal lifecycle core must extend the canonical financial core');
  assert.ok(expenseReconciliation>goalLifecycleCore);
  assert.ok(runtime>expenseReconciliation);
  assert.ok(integration>runtime);
  assert.ok(reserveAnalytics>integration);
  assert.ok(reserveEssential>reserveAnalytics,'reserve essential-spend model must consume canonical reserve/ledger data');
  assert.ok(analytics>reserveEssential,'analytics must follow reserve domain helpers');
  assert.ok(productRules>analytics);
  assert.ok(v3>productRules);
  assert.ok(reconciliationUi>v3,'expense reconciliation UI must wrap the final expense/product behavior');
  assert.ok(history>reconciliationUi,'history must see persisted reconciliation metadata');
  assert.ok(analyticsUi>history);
  assert.ok(supabase>v3);
  assert.ok(outbox>supabase);
  assert.ok(localStore>outbox,'outbox must exist before local save hooks');
  assert.ok(syncEngine>localStore,'sync engine must see local account storage');
  assert.ok(syncConflictPolicy>syncEngine,'conflict policy must exist before pull resolution');
  assert.ok(syncPull>syncConflictPolicy,'pull must consume canonical conflict policy');
  assert.ok(syncHardening>syncPull,'delete-conflict hardening must wrap the final pull implementation');
  assert.ok(productUi>syncHardening,'product UI must decorate the already-loaded sync and history layers');
  assert.ok(reserveLifecycleUi>productUi,'reserve lifecycle UI must load after its domain model and product shell');
  assert.ok(syncConflictUi>reserveLifecycleUi,'conflict resolution UI must wrap the final product topbar');
  assert.ok(goalLifecycleUi>syncConflictUi,'goal lifecycle UI must follow sync conflict controls');
  assert.ok(modalAccessibility>goalLifecycleUi,'modal accessibility must wrap the final modal behavior');
  assert.ok(bootstrap>modalAccessibility);
  assert.ok(index.includes('./arise-v3.css'));
  assert.ok(index.includes('./product-ui.css'));
});

test('index inline bootstrap JavaScript parses',()=>{
  const match=index.match(/<script>\s*([\s\S]*?)<\/script>/i);
  assert.ok(match,'inline loader script missing');
  assert.doesNotThrow(()=>new Function(match[1]));
});

test('runtime files exist',()=>{
  for(const path of ['currency-engine.js','financial-core.js','goal-lifecycle-core.js','expense-reconciliation.js','financial-runtime.js','financial-integration.js','reserve-analytics.js','reserve-essential-spend.js','analytics-engine.js','product-rules.js','arise-v3.js','arise-v3.css','expense-reconciliation-ui.js','history-inspector.js','product-ui.js','product-ui.css','reserve-lifecycle-ui.js','sync-conflict-ui.js','goal-lifecycle-ui.js','modal-accessibility.js','sync-outbox.js','local-account-store.js','sync-engine.js','sync-conflict-policy.js','sync-pull.js','sync-conflict-hardening.js','financial-bootstrap.js']){
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