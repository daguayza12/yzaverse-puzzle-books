'use strict';

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

const COVERS_DIR = path.join(__dirname, '..', 'covers');
const DOWNLOADS_DIR = 'C:/Users/Diana/Downloads';

const COVER_MAP = {
  'calm-sudoku-puzzle-book': 'Calm_Sudoku_Puzzle 2708584 (CMYK)/Paperback Cover (Calm_Sudoku_Puzzle) 6X9 110 pages Bleed CMYK.pdf',
  'hoot-and-solve-sudoku-for-kids': 'Hoot_Solve_Sudoku_Puzzle 3098635 (CMYK)/Paperback Cover (Hoot_Solve_Sudoku_Puzzle) 6X9 110 pages Bleed CMYK.pdf',
  'nyc-word-search-puzzle-book': 'NYC_6x9_Word_Search 2690694 (CMYK)/Paperback Cover (NYC_6x9_Word_Search) 6X9 110 pages Bleed CMYK.pdf',
  'slow-and-solve-sudoku-for-kids': 'Slow_Solve_Sudoku_Puzzle 3098803 (CMYK)/Paperback Cover (Slow_Solve_Sudoku_Puzzle) 6X9 110 pages Bleed CMYK.pdf',
};

async function extractEmbeddedImages(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  // Walk through all indirect objects looking for images
  const images = [];
  const enumeratedObjects = pdfDoc.context.enumerateIndirectObjects();

  for (const [ref, obj] of enumeratedObjects) {
    const dict = obj.dict || obj;
    if (!dict || !dict.get) continue;

    try {
      const subtype = dict.get && dict.lookup ? dict.lookup(pdfDoc.context.obj('/Subtype')) : null;
      if (!subtype) continue;
      const subtypeStr = subtype.toString ? subtype.toString() : '';
      if (subtypeStr !== '/Image') continue;

      const width = dict.lookup(pdfDoc.context.obj('/Width'));
      const height = dict.lookup(pdfDoc.context.obj('/Height'));

      if (width && height) {
        images.push({
          ref,
          width: typeof width === 'object' && width.numberValue ? width.numberValue() : Number(width),
          height: typeof height === 'object' && height.numberValue ? height.numberValue() : Number(height),
        });
      }
    } catch {
      // Not an image object
    }
  }

  return { pdfDoc, images, pages };
}

async function extractFrontCover(pdfBytes, slug) {
  // Strategy: Create new PDF with just a cropped front cover area,
  // then use pdf-lib to embed it. Since we can't easily render,
  // we'll extract the full cover page as a separate single-page PDF.
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0];

  const { width: pageWidth, height: pageHeight } = page.getSize();
  console.log(`  Page size: ${pageWidth} x ${pageHeight} pts`);

  // For a wrap-around cover, front is the right portion
  // Trim the left ~55% (back cover + spine)
  const frontX = Math.floor(pageWidth * 0.55);
  const frontWidth = pageWidth - frontX;

  // Create new PDF with just the front cover cropped
  const newPdf = await PDFDocument.create();
  const [embeddedPage] = await newPdf.embedPages([page], [{
    left: frontX,
    bottom: 0,
    right: pageWidth,
    top: pageHeight,
  }]);

  const newPage = newPdf.addPage([frontWidth, pageHeight]);
  newPage.drawPage(embeddedPage, { x: 0, y: 0 });

  const croppedPdfBytes = await newPdf.save();

  // Save cropped PDF temporarily so sharp/other tools can convert it
  const tmpPdfPath = path.join(COVERS_DIR, `${slug}-front.pdf`);
  fs.writeFileSync(tmpPdfPath, croppedPdfBytes);

  return { tmpPdfPath, frontWidth, pageHeight };
}

async function main() {
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }

  console.log('Extracting front covers from wrap-around PDFs...\n');

  for (const [slug, relativePath] of Object.entries(COVER_MAP)) {
    const pdfPath = path.join(DOWNLOADS_DIR, relativePath);
    const outPath = path.join(COVERS_DIR, `${slug}.jpg`);

    if (fs.existsSync(outPath)) {
      console.log(`[SKIP] ${slug}.jpg already exists`);
      continue;
    }

    if (!fs.existsSync(pdfPath)) {
      console.log(`[MISS] ${slug} — PDF not found`);
      continue;
    }

    try {
      console.log(`[CROP] ${slug}...`);
      const pdfBytes = fs.readFileSync(pdfPath);
      const { tmpPdfPath, frontWidth, pageHeight } = await extractFrontCover(pdfBytes, slug);

      // Try sharp for PDF → JPG (needs libvips+poppler)
      try {
        await sharp(tmpPdfPath, { density: 300 })
          .jpeg({ quality: 90 })
          .toFile(outPath);
        console.log(`[DONE] ${slug}.jpg`);
        fs.unlinkSync(tmpPdfPath);
      } catch {
        console.log(`[INFO] ${slug} — cropped PDF saved as ${slug}-front.pdf`);
        console.log(`       Convert manually: open in any viewer, export as JPG, save to ./covers/${slug}.jpg`);
      }
    } catch (err) {
      console.log(`[FAIL] ${slug}: ${err.message}`);
    }
  }

  console.log('\nDone. Check ./covers/ for results.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
