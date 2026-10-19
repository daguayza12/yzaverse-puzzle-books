'use strict';

const fs = require('fs');
const path = require('path');

const books = require('../books.json');
const {
  AUDIENCES,
  buildBookPageHtml,
  buildBookPageMeta,
  buildAudiencePageHtml,
  buildHomepageHtml,
  buildAboutPageHtml,
} = require('./content-builder');

// ── Config ──
// Set to repo path for project-page hosting, e.g. '/ghost-puzzles'
// Set to '' for custom-domain hosting (or root of github.io)
const BASE_URL = process.env.BASE_URL || '';

const DOCS = path.resolve(__dirname, '..', 'docs');

// ── Helpers ──

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  ✓ ${path.relative(DOCS, filePath)}`);
}

/** Resolve a path relative to BASE_URL */
function bp(p) {
  return `${BASE_URL}${p}`;
}

/** Shared HTML shell */
function htmlShell({ title, metaTitle, metaDescription, body, isHomepage }) {
  const navLinks = [
    { href: bp('/'), label: 'Home' },
    { href: bp('/sudoku-puzzle-books-for-kids/'), label: 'Kids' },
    { href: bp('/puzzle-books-for-adults-and-teens/'), label: 'Adults & Teens' },
    { href: bp('/about/'), label: 'About' },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${metaTitle}</title>
  <meta name="description" content="${metaDescription}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${bp('/css/styles.css')}">
</head>
<body>

<header class="site-header">
  <nav class="site-nav">
    <a class="site-logo" href="${bp('/')}">Yzaverse Puzzle Books</a>
    ${navLinks.map(l => `<a href="${l.href}">${l.label}</a>`).join('\n    ')}
  </nav>
</header>

<main>
  <div class="content">
    <h1 class="page-title${isHomepage ? ' sr-only' : ''}">${title}</h1>
    ${body}
  </div>
</main>

<footer class="site-footer">
  <div class="footer-inner">
    &copy; ${new Date().getFullYear()} Yzaverse Puzzle Books &middot;
    Puzzle books for kids, teens &amp; adults &middot;
    Available on <a href="https://www.amazon.com/s?k=yzaverse+puzzle+books" target="_blank" rel="noopener noreferrer">Amazon</a>
  </div>
</footer>

</body>
</html>`;
}

/**
 * content-builder generates links as /<slug>/ and image srcs as passed-in URLs.
 * Rewrite them to include BASE_URL so project-page hosting works.
 */
function rewriteLinks(html) {
  if (!BASE_URL) return html;
  // Rewrite href="/<slug>/" but not href="https://..."
  return html.replace(/href="\/([^"]*?)"/g, `href="${BASE_URL}/$1"`);
}

// ── Build steps ──

function copyCovers() {
  console.log('\n--- Copying cover images ---');
  const coversDir = path.resolve(__dirname, '..', 'covers');
  const outDir = path.join(DOCS, 'images');
  ensureDir(outDir);

  const jpgs = fs.readdirSync(coversDir).filter(f => f.endsWith('.jpg'));
  for (const file of jpgs) {
    fs.copyFileSync(path.join(coversDir, file), path.join(outDir, file));
    console.log(`  ✓ images/${file}`);
  }
}

function copyCSS() {
  console.log('\n--- Copying CSS ---');
  const outDir = path.join(DOCS, 'css');
  ensureDir(outDir);
  fs.copyFileSync(
    path.resolve(__dirname, 'styles.css'),
    path.join(outDir, 'styles.css')
  );
  console.log('  ✓ css/styles.css');
}

function buildImageUrls() {
  const urls = {};
  for (const book of books) {
    if (book.coverFile) {
      urls[book.slug] = bp(`/images/${book.coverFile}`);
    }
  }
  return urls;
}

function buildBackImageUrls() {
  const urls = {};
  const coversDir = path.resolve(__dirname, '..', 'covers');
  for (const book of books) {
    const backFile = `${book.slug}-back.jpg`;
    if (fs.existsSync(path.join(coversDir, backFile))) {
      urls[book.slug] = bp(`/images/${backFile}`);
    }
  }
  return urls;
}

function buildPages() {
  const frontUrls = buildImageUrls();
  const backUrls = buildBackImageUrls();

  // ── Homepage ──
  console.log('\n--- Homepage ---');
  const homepageBody = rewriteLinks(buildHomepageHtml(frontUrls));
  writeFile(path.join(DOCS, 'index.html'), htmlShell({
    title: 'Yzaverse Puzzle Books',
    metaTitle: 'Yzaverse Puzzle Books — Sudoku & Word Search for All Ages',
    metaDescription: 'Sudoku and word search puzzle books for kids, teens, and adults. Fun themes, calm focus, solutions included. From $5.99 on Amazon.',
    body: homepageBody,
    isHomepage: true,
  }));

  // ── Book pages ──
  console.log('\n--- Book Pages ---');
  for (const book of books) {
    const meta = buildBookPageMeta(book);
    const body = buildBookPageHtml(book, frontUrls[book.slug], backUrls[book.slug]);
    writeFile(path.join(DOCS, book.slug, 'index.html'), htmlShell({
      title: book.shortTitle,
      metaTitle: meta.meta_title,
      metaDescription: meta.meta_description,
      body,
    }));
  }

  // ── Audience pages ──
  console.log('\n--- Audience Pages ---');
  const audienceMeta = {
    kids: {
      title: 'Sudoku Puzzle Books for Kids',
      metaTitle: 'Sudoku Puzzle Books for Kids Ages 6-8 | Easy 4x4 Grids',
      metaDescription: 'Easy 4x4 sudoku puzzle books for kids ages 6-8. Fun mascot themes, solutions included. Perfect first puzzles.',
    },
    adults: {
      title: 'Puzzle Books for Adults & Teens',
      metaTitle: 'Sudoku & Word Search Puzzle Books for Adults & Teens',
      metaDescription: 'Relaxing sudoku and word search puzzle books for adults and teens. Large print, calm focus, solutions included.',
    },
  };

  for (const [key, audience] of Object.entries(AUDIENCES)) {
    const meta = audienceMeta[key];
    const audienceBooks = books.filter(b => b.audience.includes(key));
    const body = rewriteLinks(buildAudiencePageHtml(key, audienceBooks, frontUrls));
    writeFile(path.join(DOCS, audience.slug, 'index.html'), htmlShell({
      title: meta.title,
      metaTitle: meta.metaTitle,
      metaDescription: meta.metaDescription,
      body,
    }));
  }

  // ── About page ──
  console.log('\n--- About Page ---');
  writeFile(path.join(DOCS, 'about', 'index.html'), htmlShell({
    title: 'About',
    metaTitle: 'About Yzaverse Puzzle Books',
    metaDescription: 'Handcrafted sudoku and word search puzzle books for kids, teens, and adults. Made with care, available on Amazon.',
    body: buildAboutPageHtml(),
  }));
}

// ── Main ──

function main() {
  console.log('=== Yzaverse Puzzle Books — Static Site Builder ===');
  console.log(`Output: ${DOCS}`);
  if (BASE_URL) console.log(`Base URL: ${BASE_URL}`);

  // Clean docs/
  if (fs.existsSync(DOCS)) {
    fs.rmSync(DOCS, { recursive: true });
  }
  ensureDir(DOCS);

  // .nojekyll
  writeFile(path.join(DOCS, '.nojekyll'), '');

  copyCovers();
  copyCSS();
  buildPages();

  console.log('\n=== Done! ===');
  const pageCount = books.length + Object.keys(AUDIENCES).length + 2; // books + audiences + home + about
  console.log(`Generated ${pageCount} pages into docs/`);
}

main();
