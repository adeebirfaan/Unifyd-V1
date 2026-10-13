// Sends each evaluation receipt to Google Vision once and caches the text and word
// boxes, so the parser can then be re-scored offline as often as needed.
// Usage (from server/): npm run eval:receipts:ocr
// Images:  local-data/receipt-eval/images/*.jpg|jpeg|png|webp
// Output:  local-data/receipt-eval/ocr/<image file>.json   (existing files are skipped)

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vision from '@google-cloud/vision';

import { pagesFromAnnotation } from '../src/timetable-vision.js';

const ROOT = 'local-data/receipt-eval';
const IMAGES = join(ROOT, 'images');
const OCR = join(ROOT, 'ocr');
const APP_LIMIT_BYTES = 5 * 1024 * 1024;

if (!existsSync(IMAGES)) {
  console.error(`Put receipt images in server/${IMAGES}/ first.`);
  process.exit(1);
}
mkdirSync(OCR, { recursive: true });

const files = readdirSync(IMAGES).filter((file) => /\.(jpe?g|png|webp)$/i.test(file)).sort();
const client = new vision.ImageAnnotatorClient();
let done = 0;
let skipped = 0;
let failed = 0;
for (const file of files) {
  const out = join(OCR, `${file}.json`);
  if (existsSync(out)) { skipped++; continue; }
  const path = join(IMAGES, file);
  if (statSync(path).size > APP_LIMIT_BYTES) console.warn(`${file}: larger than the app's 5 MB upload limit; the app would reject it.`);
  try {
    // The same Vision call the production receipt endpoint makes.
    const [result] = await client.documentTextDetection({ image: { content: readFileSync(path) } });
    if (result.error) throw new Error(result.error.message ?? 'Vision error');
    const annotation = result.fullTextAnnotation;
    const text = annotation?.text ?? result.textAnnotations?.[0]?.description ?? '';
    writeFileSync(out, JSON.stringify({ file, text, pages: pagesFromAnnotation(annotation as never) }));
    done++;
    console.log(`${file}: cached`);
  } catch (error) {
    failed++;
    console.error(`${file}: failed (${(error as Error).message})`);
  }
}
console.log(`\n${done} cached, ${skipped} already cached, ${failed} failed, ${files.length} images.`);
