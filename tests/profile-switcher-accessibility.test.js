const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('navigation-compat.js','utf8');

test('financial profile switcher exposes an associated accessible label',()=>{
  assert.match(source,/<label class="small muted" for="profileSwitch">Профиль<\/label>/);
  assert.match(source,/<select id="profileSwitch" aria-label="Финансовый профиль">/);
  assert.doesNotMatch(source,/<span class="small muted">Профиль<\/span>/);
});

test('profile switcher keeps the canonical selection handler',()=>{
  assert.match(source,/select\.onchange=\(\)=>switchProfile\(select\.value\)/);
});
