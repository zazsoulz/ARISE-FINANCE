const test=require('node:test');
const assert=require('node:assert/strict');
const {reserveRunway}=require('../reserve-analytics.js');

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
