const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function loadReserveLifecycle(){
  const context={
    ARISE_FINANCE_CORE:{},
    ARISE_RESERVE_ANALYTICS:{},
    ARISE_RESERVE_ESSENTIAL_SPEND:{},
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('reserve-lifecycle-ui.js','utf8'),context,{filename:'reserve-lifecycle-ui.js'});
  return context.ARISE_RESERVE_LIFECYCLE;
}

test('explicit zero targetBalance overrides a legacy reserve target',()=>{
  const lifecycle=loadReserveLifecycle();
  const profile={settings:{reserve:{targetBalance:0,target:300000}}};
  assert.equal(lifecycle.reserveTarget(profile),0);
});

test('legacy reserve target remains a fallback only when targetBalance is absent',()=>{
  const lifecycle=loadReserveLifecycle();
  const profile={settings:{reserve:{target:300000}}};
  assert.equal(lifecycle.reserveTarget(profile),300000);
});
