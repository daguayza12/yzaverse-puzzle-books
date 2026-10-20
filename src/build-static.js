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
const BASE_URL = process.env.BASE_URL || '';
const SITE_URL = process.env.SITE_URL || 'https://yzaverse.com';
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

function bp(p) {
  return `${BASE_URL}${p}`;
}

// ── HTML shells ──

function navHtml() {
  const links = [
    { href: bp('/'), label: 'Home' },
    { href: bp('/puzzle-books/'), label: 'Puzzle Books' },
    { href: bp('/#merch'), label: 'Merch' },
    { href: bp('/about/'), label: 'About' },
  ];
  return `<header class="site-header">
  <nav class="site-nav">
    <a class="site-logo" href="${bp('/')}">Yzaverse</a>
    <div class="nav-pills">
      ${links.map(l => `<a class="nav-pill" href="${l.href}">${l.label}</a>`).join('\n      ')}
    </div>
  </nav>
</header>`;
}

function footerHtml() {
  return `<footer class="site-footer">
  <div class="footer-inner">
    &copy; ${new Date().getFullYear()} Yzaverse &middot;
    Puzzle books, merch &amp; more &middot;
    <a href="https://www.amazon.com/s?k=yzaverse+puzzle+books" target="_blank" rel="noopener noreferrer">Amazon</a>
  </div>
</footer>`;
}

function headHtml({ metaTitle, metaDescription, canonicalPath, ogImage }) {
  const canonical = `${SITE_URL}${canonicalPath || '/'}`;
  const ogImg = ogImage ? `${SITE_URL}${bp(`/images/${ogImage}`)}` : '';
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${metaTitle}</title>
  <meta name="description" content="${metaDescription}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${metaTitle}">
  <meta property="og:description" content="${metaDescription}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="Yzaverse">
  <meta property="og:type" content="website">${ogImg ? `
  <meta property="og:image" content="${ogImg}">` : ''}
  <meta name="twitter:card" content="summary">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/open-props/shadows.min.css">
  <link rel="stylesheet" href="https://unpkg.com/open-props/easings.min.css">
  <link rel="stylesheet" href="${bp('/css/styles.css')}">
</head>`;
}

/** Standard content page shell (book pages, audience pages, about) */
function pageShell({ metaTitle, metaDescription, title, body, canonicalPath, ogImage }) {
  return `<!DOCTYPE html>
<html lang="en">
${headHtml({ metaTitle, metaDescription, canonicalPath, ogImage })}
<body>

${navHtml()}

<main>
  <div class="content">
    <h1 class="page-title">${title}</h1>
    ${body}
  </div>
</main>

${footerHtml()}

</body>
</html>`;
}

/**
 * Rewrite content-builder links from /<slug>/ to /puzzle-books/<slug>/
 * Also apply BASE_URL prefix. Does not touch external URLs.
 */
function rewriteBookLinks(html) {
  // First move /<slug>/ links under /puzzle-books/
  // content-builder produces: href="/<slug>/" and src="/images/..."
  // We want: href="/puzzle-books/<slug>/" but leave /images/ alone
  const bookSlugs = books.map(b => b.slug);
  let result = html;
  for (const slug of bookSlugs) {
    result = result.replace(
      new RegExp(`href="/${slug}/"`, 'g'),
      `href="/puzzle-books/${slug}/"`
    );
  }
  // Also rewrite audience page links
  for (const audience of Object.values(AUDIENCES)) {
    result = result.replace(
      new RegExp(`href="/${audience.slug}/"`, 'g'),
      `href="/puzzle-books/${audience.slug}/"`
    );
  }
  // Apply BASE_URL if set
  if (BASE_URL) {
    result = result.replace(/href="\/([^"]*?)"/g, `href="${BASE_URL}/$1"`);
    result = result.replace(/src="\/([^"]*?)"/g, `src="${BASE_URL}/$1"`);
  }
  return result;
}

// ── Build steps ──

function copyImages() {
  console.log('\n--- Copying images ---');
  const coversDir = path.resolve(__dirname, '..', 'covers');
  const outDir = path.join(DOCS, 'images');
  ensureDir(outDir);
  const jpgs = fs.readdirSync(coversDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  for (const file of jpgs) {
    fs.copyFileSync(path.join(coversDir, file), path.join(outDir, file));
    console.log(`  ✓ images/${file}`);
  }
}

function copyCSS() {
  console.log('\n--- Copying CSS ---');
  const outDir = path.join(DOCS, 'css');
  ensureDir(outDir);
  fs.copyFileSync(path.resolve(__dirname, 'styles.css'), path.join(outDir, 'styles.css'));
  console.log('  ✓ css/styles.css');
}

function buildImageUrls() {
  const urls = {};
  for (const book of books) {
    if (book.coverFile) urls[book.slug] = bp(`/images/${book.coverFile}`);
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

// ── Brand landing page ──

function buildLandingPageHtml(frontUrls) {
  const publishedBooks = books.filter(b => b.amazonUrl);
  const featuredBooks = publishedBooks.length > 0 ? publishedBooks : books;

  let bookGridItems = '';
  for (const book of featuredBooks) {
    const url = frontUrls[book.slug];
    bookGridItems += `
    <a class="landing-grid-item" href="${bp(`/puzzle-books/${book.slug}/`)}">
      ${url ? `<img src="${url}" class="landing-grid-cover" alt="${book.shortTitle}" />` : ''}
      <span class="landing-grid-title">${book.shortTitle}</span>
      <span class="landing-grid-price">${book.amazonUrl ? `$${book.price.toFixed(2)}` : 'Coming soon'}</span>
    </a>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
${headHtml({
  metaTitle: 'Yzaverse — Puzzle Books, Merch & More',
  metaDescription: 'Welcome to Yzaverse. Sudoku and word search puzzle books for kids, teens, and adults. Fun themes, calm focus, solutions included. Available on Amazon.',
  canonicalPath: '/',
})}
<body>

${navHtml()}

<main>
  <div class="landing">

    <section class="landing-hero">
      <h1>Welcome to Our <span class="hero-accent">Shop</span></h1>
      <p>A quiet corner of the internet for puzzle lovers, curious kids, and anyone who needs a screen-free moment of calm.</p>
    </section>

    <hr class="section-divider">

    <section class="landing-section">
      <h2>Puzzle Books</h2>
      <p class="section-sub">Sudoku and word search for kids, teens, and adults. Solutions included, always.</p>
      <div class="landing-grid">
        ${bookGridItems}
      </div>
      <a class="cta-link" href="${bp('/puzzle-books/')}">Browse all puzzle books</a>
    </section>

    <hr class="section-divider">

    <section id="merch" class="landing-section">
      <h2>Merch</h2>
      <div class="coming-soon-card">
        <h3>Coming Soon</h3>
        <p>Cozy puzzle-themed merch for people who love a good brain teaser. Stay tuned.</p>
      </div>
    </section>

  </div>
</main>

${footerHtml()}

</body>
</html>`;
}

// ── Build all pages ──

function buildPages() {
  const frontUrls = buildImageUrls();
  const backUrls = buildBackImageUrls();

  // ── Brand landing page (root) ──
  console.log('\n--- Landing Page ---');
  writeFile(path.join(DOCS, 'index.html'), buildLandingPageHtml(frontUrls));

  // ── Puzzle books index ──
  console.log('\n--- Puzzle Books Index ---');
  const puzzleHomepageBody = rewriteBookLinks(buildHomepageHtml(frontUrls));
  writeFile(path.join(DOCS, 'puzzle-books', 'index.html'), pageShell({
    title: 'Puzzle Books',
    metaTitle: 'Yzaverse Puzzle Books — Sudoku & Word Search for All Ages',
    metaDescription: 'Sudoku and word search puzzle books for kids, teens, and adults. Fun themes, calm focus, solutions included. From $5.99 on Amazon.',
    canonicalPath: '/puzzle-books/',
    body: puzzleHomepageBody,
  }));

  // ── Individual book pages ──
  console.log('\n--- Book Pages ---');
  for (const book of books) {
    const meta = buildBookPageMeta(book);
    const body = buildBookPageHtml(book, frontUrls[book.slug], backUrls[book.slug]);
    writeFile(path.join(DOCS, 'puzzle-books', book.slug, 'index.html'), pageShell({
      title: book.shortTitle,
      metaTitle: meta.meta_title,
      metaDescription: meta.meta_description,
      canonicalPath: `/puzzle-books/${book.slug}/`,
      ogImage: book.coverFile,
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
    const body = rewriteBookLinks(buildAudiencePageHtml(key, audienceBooks, frontUrls));
    writeFile(path.join(DOCS, 'puzzle-books', audience.slug, 'index.html'), pageShell({
      title: meta.title,
      metaTitle: meta.metaTitle,
      metaDescription: meta.metaDescription,
      canonicalPath: `/puzzle-books/${audience.slug}/`,
      body,
    }));
  }

  // ── About page ──
  console.log('\n--- About Page ---');
  writeFile(path.join(DOCS, 'about', 'index.html'), pageShell({
    title: 'About',
    metaTitle: 'About Yzaverse',
    metaDescription: 'Handcrafted puzzle books, merch, and more. Made with care by Yzaverse.',
    canonicalPath: '/about/',
    body: buildAboutPageHtml(),
  }));
}

// ── Main ──

function main() {
  console.log('=== Yzaverse — Static Site Builder ===');
  console.log(`Output: ${DOCS}`);
  if (BASE_URL) console.log(`Base URL: ${BASE_URL}`);

  if (fs.existsSync(DOCS)) fs.rmSync(DOCS, { recursive: true });
  ensureDir(DOCS);

  writeFile(path.join(DOCS, '.nojekyll'), '');
  if (!BASE_URL) writeFile(path.join(DOCS, 'CNAME'), 'yzaverse.com');

  copyImages();
  copyCSS();
  buildPages();

  const pageCount = books.length + Object.keys(AUDIENCES).length + 3; // books + audiences + landing + puzzle index + about
  console.log(`\n=== Done! Generated ${pageCount} pages into docs/ ===`);
}

main();
