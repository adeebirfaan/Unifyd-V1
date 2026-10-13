// Sends each evaluation receipt to Google Vision once and caches the text and word
// boxes, so the parser can then be re-scored offline as often as needed.
// Usage (from server/): npm run eval:receipts:ocr   (also the second step of eval:receipts:run)
// Images:  local-data/receipt-eval/images/*.jpg|jpeg|png|webp
// Output:  local-data/receipt-eval/ocr/<image file>.json   (existing files are skipped)

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vision from '@google-cloud/vision';

import { pagesFromAnnotation } from '../src/timetable-vision.js';
import { IMAGES, OCR, listImages } from './receipt-eval-paths.js';

const APP_LIMIT_BYTES = 5 * 1024 * 1024;

mkdirSync(IMAGES, { recursive: true });
mkdirSync(OCR, { recursive: true });

const files = listImages().images;
const pendingFiles = files.filter((file) => !existsSync(join(OCR, `${file}.json`)));
if (pendingFiles.length) console.log(`Reading ${pendingFiles.length} new image(s) with Google Vision...`);
// Created only when needed, so a fully cached run never contacts Google.
const client = pendingFiles.length ? new vision.ImageAnnotatorClient() : null;
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
    const [result] = await client!.documentTextDetection({ image: { content: readFileSync(path) } });
    if (result.error) throw new Error(result.error.message ?? 'Vision error');
    const annotation = result.fullTextAnnotation;
    const text = annotation?.text ?? result.textAnnotations?.[0]?.description ?? '';
    writeFileSync(out, JSON.stringify({ file, text, pages: pagesFromAnnotation(annotation as never) }));
    done++;
    console.log(`${file}: cached`);
  } catch (error) {
    failed++;
    const message = (error as Error).message;
    console.error(`${file}: failed (${message})`);
    // Without credentials every image fails the same way, so stop with the fix instead.
    if (/default credentials|could not load|unauthenticated|permission/i.test(message)) {
      console.error('\nGoogle credentials are missing or not allowed to use Vision. Run "gcloud auth application-default login",');
      console.error('check that the server receipt scan works, then run this command again.');
      process.exit(1);
    }
  }
}
console.log(`OCR: ${done} newly read, ${skipped} already cached, ${failed} failed, ${files.length} images.`);
if (failed) process.exitCode = 1;
