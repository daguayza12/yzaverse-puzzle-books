'use strict';

const books = require('../books.json');

// ── Helpers ──

function amazonButton(book) {
  if (!book.amazonUrl) {
    return `<p><em>Coming soon on Amazon</em></p>`;
  }
  return `<p><a href="${book.amazonUrl}" target="_blank" rel="noopener noreferrer" class="amazon-btn">Buy on Amazon — $${book.price.toFixed(2)}</a></p>`;
}

// ── Tag rules ──

const AUDIENCES = {
  kids: { label: 'Kids (Ages 6–8)', slug: 'sudoku-puzzle-books-for-kids', tag: 'Kids' },
  adults: { label: 'Adults & Teens', slug: 'puzzle-books-for-adults-and-teens', tag: 'Adults & Teens' },
};
const TYPE_TAG_MAP = { '4x4 sudoku': 'Sudoku', '9x9 sudoku': 'Sudoku', 'word search': 'Word Search' };
const MASCOT_TAG_MAP = { turtle: 'Turtle', owl: 'Owl' };

function buildBookTags(book) {
  const tags = [];
  for (const audience of book.audience) {
    if (AUDIENCES[audience]) tags.push(AUDIENCES[audience].tag);
  }
  if (TYPE_TAG_MAP[book.type]) tags.push(TYPE_TAG_MAP[book.type]);
  if (MASCOT_TAG_MAP[book.mascot]) tags.push(MASCOT_TAG_MAP[book.mascot]);
  if (book.type === 'word search') tags.push('Large Print', 'NYC');
  return tags.map(name => ({ name }));
}

// ── Book covers helper ──

function bookCovers(book, frontUrl, backUrl) {
  if (!frontUrl && !backUrl) return '';
  const imgs = [];
  if (frontUrl) imgs.push(`<img src="${frontUrl}" class="book-cover" alt="${book.title} — Front Cover" />`);
  if (backUrl) imgs.push(`<img src="${backUrl}" class="book-cover" alt="${book.title} — Back Cover" />`);
  return `<div class="book-covers">${imgs.join('\n')}</div>`;
}

// ── Book page content — clean semantic HTML, no inline styles ──

function kidsBookPageHtml(book, frontUrl, backUrl) {
  const mascotName = book.mascot === 'turtle' ? 'a friendly turtle' : 'a wise little owl';
  return `
${bookCovers(book, frontUrl, backUrl)}

<p><strong>${book.shortTitle}</strong> — ${book.puzzleCount} easy 4x4 sudoku puzzles with ${mascotName} for kids ages 6–8. Numbers 1–4, solutions included.</p>

${amazonButton(book)}

<h3>What's Inside</h3>
<ul>
<li>${book.puzzleCount} easy 4x4 grids — perfect first sudoku</li>
<li>${book.mascot === 'turtle' ? 'Turtle' : 'Owl'}-themed pages kids love</li>
<li>Solutions in the back</li>
<li>Great for rainy days, road trips, and screen-free time</li>
</ul>
`;
}

function adultsBookPageHtml(book, frontUrl, backUrl) {
  return `
${bookCovers(book, frontUrl, backUrl)}

<p>${book.tagline ? `<em>"${book.tagline}"</em> — ` : ''}<strong>${book.title}</strong> is ${book.puzzleCount}+ classic 9×9 sudoku puzzles for calm, focused relaxation. ${book.size}, ${book.pages} pages, solutions included.</p>

${amazonButton(book)}

<h3>What's Inside</h3>
<ul>
<li>${book.puzzleCount}+ classic 9×9 sudoku puzzles</li>
<li>Comfortable ${book.size} format, ${book.pages} pages</li>
<li>All solutions included</li>
<li>A thoughtful gift for puzzle lovers</li>
</ul>
`;
}

function wordSearchBookPageHtml(book, frontUrl, backUrl) {
  return `
${bookCovers(book, frontUrl, backUrl)}

<p><strong>${book.shortTitle}</strong> — ${book.puzzleCount}+ NYC-themed word search puzzles in large, easy-to-read print. Landmarks, neighborhoods, and more. ${book.pages} pages, solutions included.</p>

${amazonButton(book)}

<h3>What's Inside</h3>
<ul>
<li>${book.puzzleCount}+ word search puzzles about NYC</li>
<li>Large print, easy on the eyes (${book.size})</li>
<li>Great for teens, adults, and NYC fans</li>
<li>Solutions in the back</li>
</ul>
`;
}

function buildBookPageHtml(book, frontUrl, backUrl) {
  if (book.audience.includes('kids')) return kidsBookPageHtml(book, frontUrl, backUrl);
  if (book.type === 'word search') return wordSearchBookPageHtml(book, frontUrl, backUrl);
  return adultsBookPageHtml(book, frontUrl, backUrl);
}

function buildBookPageMeta(book) {
  const metaTitles = {
    kids: `${book.shortTitle} | Easy 4x4 Sudoku Puzzle Book for Kids Ages 6-8`,
    adults: `${book.title} | Puzzle Book with Solutions`,
  };

  const descriptions = {
    kids: `${book.puzzleCount} easy 4x4 sudoku puzzles for kids ages 6-8. ${book.mascot === 'turtle' ? 'Turtle' : 'Owl'}-themed brain games with solutions. Paperback $${book.price.toFixed(2)}.`,
    adults: `${book.puzzleCount}+ puzzles for calm focus. ${book.size}, ${book.pages} pages, solutions included. Paperback $${book.price.toFixed(2)}.`,
  };

  const audience = book.audience[0];
  let title = metaTitles[audience] || `${book.title} | Puzzle Book`;
  let desc = descriptions[audience] || `${book.title} by Yzaverse Puzzle Books.`;
  if (title.length > 60) title = title.substring(0, 57) + '...';
  if (desc.length > 155) desc = desc.substring(0, 152) + '...';

  return {
    meta_title: title,
    meta_description: desc,
  };
}

// ── Book card for listings ──

function bookCard(book, imageUrl) {
  return `<div class="book-card">
${imageUrl ? `<div class="book-card-image"><img src="${imageUrl}" class="book-thumb" alt="${book.title}" /></div>` : ''}
<div class="book-card-info">
<h3><a href="/${book.slug}/">${book.shortTitle}</a></h3>
<p>${book.subtitle}</p>
${amazonButton(book)}
</div>
</div>`;
}

// ── Audience pages ──

function buildAudiencePageHtml(audienceKey, audienceBooks, imageUrls) {
  const intros = {
    kids: `<p>Our puzzle books for kids ages 6–8 make learning fun. Easy 4x4 sudoku grids with friendly mascots, solutions included, and the right level of challenge to build confidence.</p>`,
    adults: `<p>Puzzle books designed for calm focus. Sudoku and word search in easy-to-read print, thoughtful design, and puzzles that let you unwind at your own pace. Perfect for yourself or as a gift.</p>`,
  };

  let html = intros[audienceKey] || '';

  for (const book of audienceBooks) {
    html += bookCard(book, imageUrls[book.slug]);
  }

  return html;
}

// ── Homepage ──

function buildHomepageHtml(imageUrls) {
  const publishedBooks = books.filter(b => b.amazonUrl);
  const featuredBooks = publishedBooks.length > 0 ? publishedBooks : books;

  let html = `
<div class="homepage-hero">
  <p class="hero-tagline">Sudoku & Word Search Puzzle Books for Kids, Teens & Adults</p>
  <p class="hero-sub">Fun themes. Calm focus. Solutions included. All on Amazon.</p>
</div>

<div class="book-grid">`;

  for (const book of featuredBooks) {
    const url = imageUrls[book.slug];
    html += `
  <a class="book-grid-item" href="/${book.slug}/">
    ${url ? `<img src="${url}" class="book-grid-cover" alt="${book.shortTitle}" />` : ''}
    <span class="book-grid-title">${book.shortTitle}</span>
    <span class="book-grid-price">${book.amazonUrl ? `$${book.price.toFixed(2)}` : 'Coming soon'}</span>
  </a>`;
  }

  html += `
</div>`;

  return html;
}

// ── About page ──

function buildAboutPageHtml() {
  return `
<p>Hi! I'm the creator behind <strong>Yzaverse Puzzle Books</strong>.</p>

<p>I started making puzzle books because I wanted something simple, screen-free, and fun for all ages. Puzzles have always been a go-to for me when I need to slow down and focus, and I wanted to share that with others.</p>

<h3>What I Make</h3>
<ul>
<li><strong>Sudoku for kids</strong> with easy 4x4 grids and friendly mascots, designed for ages 6 to 8</li>
<li><strong>Sudoku for adults</strong> with classic 9x9 puzzles for quiet relaxation</li>
<li><strong>Word search</strong> with NYC-themed puzzles in large, easy-to-read print</li>
</ul>

<p>Every book includes solutions and is available in paperback on Amazon.</p>

<h3>Why Puzzles?</h3>
<p>Puzzles are portable, timeless, and don't need a charger. They help kids build confidence and give adults a break from screens. I care about the details: the themes, the print size, and the paper quality all matter.</p>

`;
}

module.exports = {
  AUDIENCES,
  buildBookPageHtml,
  buildBookPageMeta,
  buildBookTags,
  buildAudiencePageHtml,
  buildHomepageHtml,
  buildAboutPageHtml,
};
