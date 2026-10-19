'use strict';

require('dotenv').config();

const books = require('../books.json');
const ghost = require('./ghost-client');
const { TAGS } = require('./tags');
const { extractCovers } = require('./cover-extractor');
const {
  AUDIENCES,
  buildBookPageHtml,
  buildBookPageMeta,
  buildBookTags,
  buildAudiencePageHtml,
  buildHomepageHtml,
  buildAboutPageHtml,
} = require('./content-builder');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== Yzaverse Puzzle Books — Ghost Publisher ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  ghost.init({ dryRun: DRY_RUN });

  // ── 1. Find cover images ──
  console.log('\n--- Cover Images ---');
  const coverPaths = await extractCovers();

  // ── 2. Upload front + back covers ──
  console.log('\n--- Image Upload ---');
  const frontUrls = {};
  const backUrls = {};
  for (const book of books) {
    const frontPath = coverPaths[book.slug];
    frontUrls[book.slug] = frontPath ? await ghost.uploadImage(frontPath) : null;
    if (!frontPath) console.log(`  [SKIP] No front cover for ${book.slug}`);

    const backPath = coverPaths[`${book.slug}-back`];
    backUrls[book.slug] = backPath ? await ghost.uploadImage(backPath) : null;
    if (!backPath) console.log(`  [SKIP] No back cover for ${book.slug}`);
  }

  // ── 3. Create tags ──
  console.log('\n--- Tags ---');
  for (const tag of TAGS) {
    await ghost.ensureTag(tag);
  }

  // ── 4. Create book pages ──
  console.log('\n--- Book Pages ---');
  for (const book of books) {
    const meta = buildBookPageMeta(book);

    await ghost.ensurePage({
      title: book.shortTitle,
      slug: book.slug,
      html: buildBookPageHtml(book, frontUrls[book.slug], backUrls[book.slug]),
      meta_title: meta.meta_title,
      meta_description: meta.meta_description,
      feature_image: null,
      tags: buildBookTags(book),
      status: 'published',
    });
  }

  // ── 5. Create audience pages ──
  console.log('\n--- Audience Pages ---');
  const audienceMeta = {
    kids: {
      title: 'Sudoku Puzzle Books for Kids',
      meta_title: 'Sudoku Puzzle Books for Kids Ages 6-8 | Easy 4x4 Grids',
      meta_description: 'Easy 4x4 sudoku puzzle books for kids ages 6-8. Fun mascot themes, solutions included. Perfect first puzzles.',
    },
    adults: {
      title: 'Puzzle Books for Adults & Teens',
      meta_title: 'Sudoku & Word Search Puzzle Books for Adults & Teens',
      meta_description: 'Relaxing sudoku and word search puzzle books for adults and teens. Large print, calm focus, solutions included.',
    },
  };

  for (const [key, audience] of Object.entries(AUDIENCES)) {
    const meta = audienceMeta[key];
    const audienceBooks = books.filter(b => b.audience.includes(key));

    await ghost.ensurePage({
      title: meta.title,
      slug: audience.slug,
      html: buildAudiencePageHtml(key, audienceBooks, frontUrls),
      meta_title: meta.meta_title,
      meta_description: meta.meta_description,
      tags: [{ name: audience.tag }],
      status: 'published',
    });
  }

  // ── 6. Homepage ──
  console.log('\n--- Homepage ---');
  await ghost.ensurePage({
    title: 'Puzzle Books for Every Age',
    slug: 'home',
    html: buildHomepageHtml(frontUrls),
    meta_title: 'Yzaverse Puzzle Books — Sudoku & Word Search for All Ages',
    meta_description: 'Sudoku and word search puzzle books for kids, teens, and adults. Fun themes, calm focus, solutions included. From $5.99 on Amazon.',
    tags: [],
    status: 'published',
  });

  // ── 7. About page ──
  console.log('\n--- About Page ---');
  await ghost.ensurePage({
    title: 'About',
    slug: 'about',
    html: buildAboutPageHtml(),
    meta_title: 'About Yzaverse Puzzle Books',
    meta_description: 'Handcrafted sudoku and word search puzzle books for kids, teens, and adults. Made with care, available on Amazon.',
    tags: [],
    status: 'published',
  });

  console.log('\n=== Done! ===');
  console.log(`Created/updated: ${books.length} book pages, ${Object.keys(AUDIENCES).length} audience pages, 1 homepage, 1 about page, ${TAGS.length} tags`);
  if (DRY_RUN) {
    console.log('(This was a dry run — nothing was sent to Ghost)\n');
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
