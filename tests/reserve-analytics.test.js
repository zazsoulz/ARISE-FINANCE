const test=require('node:test');
const assert=require('node:assert/strict');
const {reserveRunway,reserveProgress,reserveTarget,normalizeTargetSettings}=require('../reserve-analytics.js');

test('reserve runway reports exact fractional months',()=>{
  const result=reserveRunway({reserveBalance:125000,monthlyEssentialSpend:50000});
  assert.equal(result.status,'ok');
  assert.equal(result.months,2.5);
  assert.equal(result.wholeMonths,2);
  assert.equal(result.remainder,25000);
});

test('reserve runway handles exact whole months',()=>{
  const result=reserveRunway({reserveBalance:150000,monthlyEssentialSpend:50000});
  assert.equal(result.status,'ok');
  assert.equal(result.months,3);
  assert.equal(result.wholeMonths,3);
  assert.equal(result.remainder,0);
});

test('reserve runway does not invent a denominator when essential spend is unknown',()=>{
  const result=reserveRunway({reserveBalance:150000,monthlyEssentialSpend:0});
  assert.deepEqual(result,{
    status:'insufficient_data',
    reserveBalance:150000,
    monthlyEssentialSpend:0,
    months:null,
    wholeMonths:null,
    remainder:150000
  });
});

test('reserve runway sanitizes invalid and negative inputs',()=>{
  assert.deepEqual(reserveRunway({reserveBalance:-100,monthlyEssentialSpend:-10}),{
    status:'insufficient_data',
    reserveBalance:0,
    monthlyEssentialSpend:0,
    months:null,
    wholeMonths:null,
    remainder:0
  });
  assert.equal(reserveRunway({reserveBalance:'100000',monthlyEssentialSpend:'40000'}).months,2.5);
});

test('reserve progress reports partial target completion',()=>{
  assert.deepEqual(reserveProgress({reserveBalance:75000,targetBalance:300000}),{
    status:'ok',
    reserveBalance:75000,
    targetBalance:300000,
    remaining:225000,
    progress:0.25,
    percent:25,
    complete:false,
    surplus:0
  });
});

test('reserve progress marks completed and preserves surplus',()=>{
  const result=reserveProgress({reserveBalance:350000,targetBalance:300000});
  assert.equal(result.status,'ok');
  assert.equal(result.progress,1);
  assert.equal(result.percent,100);
  assert.equal(result.remaining,0);
  assert.equal(result.complete,true);
  assert.equal(result.surplus,50000);
});

test('reserve progress does not invent a target',()=>{
  assert.deepEqual(reserveProgress({reserveBalance:50000,targetBalance:0}),{
    status:'no_target',
    reserveBalance:50000,
    targetBalance:0,
    remaining:null,
    progress:null,
    percent:null,
    complete:false,
    surplus:0
  });
});

test('reserve progress sanitizes invalid inputs',()=>{
  assert.deepEqual(reserveProgress({reserveBalance:-500,targetBalance:'bad'}),{
    status:'no_target',
    reserveBalance:0,
    targetBalance:0,
    remaining:null,
    progress:null,
    percent:null,
    complete:false,
    surplus:0
  });
});

test('canonical targetBalance wins even when explicitly cleared to zero',()=>{
  assert.equal(reserveTarget({targetBalance:0,target:300000}),0);
  const normalized=normalizeTargetSettings({targetBalance:0,target:300000,monthlyEssentialSpend:60000});
  assert.equal(normalized.changed,true);
  assert.equal(normalized.targetBalance,0);
  assert.deepEqual(normalized.settings,{targetBalance:0,monthlyEssentialSpend:60000});
});

test('legacy reserve target migrates to canonical targetBalance without changing value',()=>{
  assert.equal(reserveTarget({target:300000}),300000);
  const normalized=normalizeTargetSettings({target:300000,essentialCategoryIds:['rent']});
  assert.equal(normalized.changed,true);
  assert.equal(normalized.targetBalance,300000);
  assert.deepEqual(normalized.settings,{targetBalance:300000,essentialCategoryIds:['rent']});
});