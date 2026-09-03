const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const legacyAsset = path.join(root, 'assets', 'arise-flow-organic-v3.webp');
const runtimeFiles = [
  'index.html',
  'app-shell.html',
  'arise-v3.js',
  'arise-v3.css',
  'home-particle-matter.js',
  'product-ui.js',
  'product-ui.css'
].filter(file => fs.existsSync(path.join(root, file)));

assert.strictEqual(
  fs.existsSync(legacyAsset),
  false,
  'legacy raster home-flow asset must stay physically retired'
);

for (const file of runtimeFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.strictEqual(
    source.includes('arise-flow-organic-v3.webp'),
    false,
    `${file} must not reference the retired raster home-flow asset`
  );
}

console.log('home-flow raster retirement guard passed');
