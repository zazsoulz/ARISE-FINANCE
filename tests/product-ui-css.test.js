const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const shell=fs.readFileSync('app-shell.html','utf8');
const css=fs.readFileSync('product-ui.css','utf8');

test('product modal polish targets the real shell modal and sheet selectors',()=>{
  assert.ok(shell.includes('.modal.open'));
  assert.ok(shell.includes('.sheet{'));
  assert.ok(css.includes('.modal{backdrop-filter:blur(16px)'));
  assert.ok(css.includes('.sheet{border-color:var(--product-border)'));
  assert.equal(css.includes('.modal-overlay'),false);
  assert.equal(css.includes('.modal-card'),false);
});
