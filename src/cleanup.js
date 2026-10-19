'use strict';

require('dotenv').config();
const ghost = require('./ghost-client');

const ORPHAN_SLUGS = [
  'kids-puzzle-books',
  'teen-puzzle-books',
  'adult-puzzle-books',
  'books',
  'word-search-puzzle-books-for-teens',
  'sudoku-puzzle-books-for-adults-and-seniors',
  'puzzle-books',
];

const DRY_RUN = process.argv.includes('--dry-run');

async function cleanup() {
  console.log(`Cleaning up orphan pages... (${DRY_RUN ? 'DRY RUN' : 'LIVE'})\n`);
  ghost.init({ dryRun: DRY_RUN });

  for (const slug of ORPHAN_SLUGS) {
    try {
      await ghost.deletePage(slug);
    } catch (err) {
      console.log(`  [FAIL] ${slug}: ${err.message}`);
    }
  }

  console.log('\nDone.');
}

cleanup().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
