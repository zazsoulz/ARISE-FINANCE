const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function run(context){
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('runtime-integrity.js','utf8'),context);
  return context.ARISE_RUNTIME_INTEGRITY.verify();
}

test('canonical runtime passes only when legacy engine was stripped and required core API exists',()=>{
  const core={};
  for(const name of ['planIncome','monthStats','availableFree','reserveBalance','goalBalance','validatePlan'])core[name]=()=>{};
  const result=run({ARISE_FINANCE_CORE:core,__ARISE_LEGACY_FINANCIAL_STRIPPED__:true,Date});
  assert.equal(result.ok,true);
  assert.equal(result.legacyStripped,true);
  assert.equal(result.missing.length,0);
});

test('missing strip marker fails closed',()=>{
  const core={};
  for(const name of ['planIncome','monthStats','availableFree','reserveBalance','goalBalance','validatePlan'])core[name]=()=>{};
  const result=run({ARISE_FINANCE_CORE:core,Date});
  assert.equal(result.ok,false);
  assert.equal(result.legacyStripped,false);
});

test('missing canonical core method fails closed',()=>{
  const result=run({ARISE_FINANCE_CORE:{planIncome(){}} ,__ARISE_LEGACY_FINANCIAL_STRIPPED__:true,Date});
  assert.equal(result.ok,false);
  assert.ok(result.missing.includes('monthStats'));
});

test('production loader marks legacy finance stripped and loads integrity immediately before bootstrap',()=>{
  const index=fs.readFileSync('index.html','utf8');
  assert.match(index,/__ARISE_LEGACY_FINANCIAL_STRIPPED__=true/);
  const integrity=index.indexOf('./runtime-integrity.js');
  const bootstrap=index.indexOf('./financial-bootstrap.js');
  assert.ok(integrity>0&&bootstrap>integrity);
  assert.equal(index.slice(integrity,bootstrap).includes('./financial-core.js'),false);
});
