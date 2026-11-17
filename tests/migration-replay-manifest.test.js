'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inventory } = require('../scripts/migration-replay-manifest');

function withDir(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arise-migrations-'));
  try {
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('ordered inventory produces stable SHA256 evidence', () => {
  withDir({ '20260820000001_second.sql': 'select 2;', '20260820000000_first.sql': 'select 1;' }, dir => {
    const a = inventory(dir);
    assert.deepEqual(a.map(x => x.version), ['20260820000000', '20260820000001']);
    assert.deepEqual(inventory(dir), a);
    assert.match(a[0].sha256, /^[a-f0-9]{64}$/);
  });
});
test('fails closed on empty migration chain', () => withDir({}, dir => assert.throws(() => inventory(dir), /No SQL migrations/)));
test('fails closed on duplicate versions', () => withDir({
  '20260820000000_first.sql': 'select 1;',
  '20260820000000_second.sql': 'select 2;'
}, dir => assert.throws(() => inventory(dir), /Duplicate migration version/)));
test('fails closed on invalid names and blank SQL', () => {
  withDir({ 'bad.sql': 'select 1;' }, dir => assert.throws(() => inventory(dir), /Invalid migration filename/));
  withDir({ '20260820000000_empty.sql': '  ' }, dir => assert.throws(() => inventory(dir), /Empty migration/));
});
