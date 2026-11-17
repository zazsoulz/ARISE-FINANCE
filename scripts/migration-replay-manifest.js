#!/usr/bin/env node
'use strict';

// Read-only, deterministic migration inventory for isolated replay evidence.
// Never connects to a database or prints secrets.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function inventory(dir) {
  const names = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
  if (names.length === 0) throw new Error('No SQL migrations found');
  const seen = new Set();
  return names.map((name) => {
    if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(name)) {
      throw new Error('Invalid migration filename: ' + name);
    }
    const version = name.slice(0, 14);
    if (seen.has(version)) throw new Error('Duplicate migration version: ' + version);
    seen.add(version);
    const bytes = fs.readFileSync(path.join(dir, name));
    if (!bytes.length || !bytes.toString('utf8').trim()) {
      throw new Error('Empty migration: ' + name);
    }
    return { file: name, version, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  });
}

if (require.main === module) {
  try {
    const dir = process.argv[2] || path.join(__dirname, '..', 'supabase', 'migrations');
    const migrations = inventory(dir);
    process.stdout.write(JSON.stringify({ format: 'arise-migration-manifest-v1', migrations }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write('Migration inventory failed: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { inventory };
