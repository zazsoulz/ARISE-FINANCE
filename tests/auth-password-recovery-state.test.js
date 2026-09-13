const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('auth-ui.js','utf8');

test('password recovery exposes a dedicated in-flight state and prevents duplicate requests',()=>{
  assert.match(source,/reset\.disabled=true/);
  assert.match(source,/setMessage\("Отправляю ссылку…"\)/);
  assert.match(source,/finally\{reset\.disabled=false;\}/);
});

test('password recovery uses recovery-specific fallback copy',()=>{
  assert.match(source,/function humanAuthError\(error,action="login"\)/);
  assert.match(source,/if\(action==="reset"\) return "Не удалось отправить ссылку для смены пароля\. Проверь почту и соединение\."/);
  assert.match(source,/humanAuthError\(error,"reset"\)/);
});
