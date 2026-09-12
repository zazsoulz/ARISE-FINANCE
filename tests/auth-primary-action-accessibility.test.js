const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('auth-ui.js','utf8');

test('auth primary and secondary actions remain explicit non-submitting buttons',()=>{
  assert.match(source,/<button class="btn primary" id="authSubmit" type="button">/);
  assert.match(source,/<button class="btn" id="authToggle" type="button">/);
  assert.match(source,/<button class="btn" id="authReset" type="button">/);
});

test('auth fields preserve semantic input types, labels and browser autocomplete hints',()=>{
  assert.match(source,/<label for="authName">Имя<\/label>/);
  assert.match(source,/<label for="authEmail">Почта<\/label>/);
  assert.match(source,/<label for="authPassword">Пароль<\/label>/);
  assert.match(source,/id="authName" autocomplete="name"[^>]+aria-describedby="authMessage"/);
  assert.match(source,/id="authEmail" type="email" autocomplete="email"[^>]+required[^>]+aria-describedby="authMessage"/);
  assert.match(source,/id="authPassword" type="password" autocomplete="current-password"[^>]+required[^>]+aria-describedby="authMessage"/);
  assert.match(source,/passwordInput\.autocomplete=registering\?"new-password":"current-password"/);
  assert.match(source,/nameInput\.required=registering/);
});

test('auth validation identifies and focuses the field that blocks the action',()=>{
  assert.match(source,/field\.setAttribute\("aria-invalid","true"\)/);
  assert.match(source,/field\.focus\(\)/);
  assert.match(source,/invalidateField\(nameInput,"Укажи имя для аккаунта\."\)/);
  assert.match(source,/invalidateField\(emailInput,"Укажи почту\."\)/);
  assert.match(source,/invalidateField\(passwordInput,"Укажи пароль\."\)/);
  assert.match(source,/invalidateField\(emailInput,"Укажи почту, на которую отправить ссылку\."\)/);
  assert.match(source,/id="authMessage"[^>]+role="status" aria-live="polite"/);
});

test('decorative auth flow remains hidden from assistive technology',()=>{
  assert.match(source,/<aside class="login-visual" aria-hidden="true">/);
  assert.match(source,/class="login-assurance"><i aria-hidden="true"><\/i>/);
});
