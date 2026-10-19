'use strict';

const fs = require('fs');
const path = require('path');

const COVERS_DIR = path.join(__dirname, '..', 'covers');

/**
 * Look for pre-converted cover JPGs in ./covers/{slug}.jpg
 * To generate these from PDFs, run: node src/extract-covers.js
 */
async function extractCovers() {
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }

  const results = {};
  const files = fs.readdirSync(COVERS_DIR);

  for (const file of files) {
    if (!file.endsWith('.jpg')) continue;
    const slug = file.replace('.jpg', '');
    results[slug] = path.join(COVERS_DIR, file);
    console.log(`[COVERS] Found: ${file}`);
  }

  if (Object.keys(results).length === 0) {
    console.log('[COVERS] No JPGs found in ./covers/');
    console.log('  Run: node src/extract-covers.js (or powershell src/convert-covers.ps1)');
  }

  return results;
}

module.exports = { extractCovers, COVERS_DIR };
