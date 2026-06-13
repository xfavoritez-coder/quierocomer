import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  // Download the PDF directly
  const driveUrl = 'https://drive.google.com/uc?export=download&id=1ujWUm6asCq6QG1eRfg3b8mHBNmtXmLM-';

  console.log('Downloading PDF...');
  const res = await fetch(driveUrl, { redirect: 'follow' });
  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`PDF size: ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB`);

  // Test rendering pages to images
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('@napi-rs/canvas');

  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true }).promise;
  console.log(`Pages: ${doc.numPages}`);

  let totalSize = 0;
  for (let i = 1; i <= Math.min(doc.numPages, 3); i++) { // Just first 3 pages as test
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx as any, viewport, canvas: canvas as any }).promise;
    const jpegBuf = canvas.toBuffer('image/jpeg', 80);
    totalSize += jpegBuf.byteLength;
    console.log(`  Page ${i}: ${canvas.width}x${canvas.height} → ${(jpegBuf.byteLength / 1024).toFixed(0)}KB JPEG`);
  }

  console.log(`\nAvg per page: ${(totalSize / 3 / 1024).toFixed(0)}KB`);
  console.log(`Estimated total (${doc.numPages} pages): ${(totalSize / 3 * doc.numPages / 1024 / 1024).toFixed(1)}MB`);

  await doc.destroy();
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
