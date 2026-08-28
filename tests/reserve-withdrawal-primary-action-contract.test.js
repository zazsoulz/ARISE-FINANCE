const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('reserve-lifecycle-ui.js','utf8');

test('reserve withdrawal remains a live primary action',()=>{
  assert.match(source,/id="reserveWithdrawAction"/,'reserve withdrawal control is missing');
  assert.match(source,/id="reserveWithdrawAction"[^>]*\$\{balance<=0\?"disabled":""\}/,'withdrawal control must be disabled only when the reserve is empty');
  assert.match(source,/document\.getElementById\("reserveWithdrawAction"\)\?\.addEventListener\("click",showReserveWithdrawalModal\)/,'reserve withdrawal control is not bound to its canonical action');
  assert.match(source,/function showReserveWithdrawalModal\(\)/,'canonical reserve withdrawal flow is missing');
  assert.match(source,/id="reserveWithdrawAmount"/,'reserve withdrawal sheet is missing its amount input');
  assert.match(source,/id="saveReserveWithdrawal"/,'reserve withdrawal sheet is missing its commit action');
  assert.match(source,/core\.createReserveWithdrawal\(profile,/,'reserve withdrawal commit does not use the canonical financial core');
});
