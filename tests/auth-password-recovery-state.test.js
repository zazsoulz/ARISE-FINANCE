const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('auth-ui.js','utf8');

test('auth actions share one in-flight state and prevent overlapping requests',()=>{
  assert.match(source,/let authBusy=false/);
  assert.match(source,/const setAuthBusy=busy=>/);
  assert.match(source,/for\(const control of \[submit,toggle,reset\]\) if\(control\) control\.disabled=authBusy/);
  assert.match(source,/reset\.onclick=async\(\)=>\{\n      if\(authBusy\)return;/);
  assert.match(source,/submit\.onclick=async\(\)=>\{\n      if\(authBusy\)return;/);
  assert.match(source,/finally\{setAuthBusy\(false\);\}/);
});

test('password recovery exposes a dedicated in-flight message',()=>{
  assert.match(source,/setMessage\("Отправляю ссылку…"\)/);
});

test('password recovery uses recovery-specific fallback copy',()=>{
  assert.match(source,/function humanAuthError\(error,action="login"\)/);
  assert.match(source,/if\(action==="reset"\) return "Не удалось отправить ссылку для смены пароля\. Проверь почту и соединение\."/);
  assert.match(source,/humanAuthError\(error,"reset"\)/);
});

test('registration captures action before awaiting and keeps registration-specific fallback copy',()=>{
  assert.match(source,/const action=mode;/);
  assert.match(source,/if\(action==="register"\) return "Не удалось создать аккаунт\. Проверь данные и соединение\."/);
  assert.match(source,/humanAuthError\(error,action\)/);
});
