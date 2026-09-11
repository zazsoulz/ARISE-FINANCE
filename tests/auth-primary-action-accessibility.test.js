const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('auth-ui.js','utf8');

test('auth secondary actions remain explicit non-submitting buttons',()=>{
  assert.match(source,/<button class="btn" id="authToggle" type="button">/);
  assert.match(source,/<button class="btn" id="authReset" type="button">/);
});

test('auth fields preserve semantic input types and browser autocomplete hints',()=>{
  assert.match(source,/id="authName" autocomplete="name"/);
  assert.match(source,/id="authEmail" type="email" autocomplete="email"/);
  assert.match(source,/id="authPassword" type="password" autocomplete="current-password"/);
});

test('decorative auth flow remains hidden from assistive technology',()=>{
  assert.match(source,/<aside class="login-visual" aria-hidden="true">/);
  assert.match(source,/class="login-assurance"><i aria-hidden="true"><\/i>/);
});
