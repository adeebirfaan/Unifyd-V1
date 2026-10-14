// Sends each evaluation receipt to Google Vision once and caches the text and word
// boxes, so the parser can then be re-scored offline as often as needed.
// Usage (from server/): npm run eval:receipts:ocr   (also the second step of eval:receipts:run)
//                       --final: the final test set (second step of eval:receipts:final-setup); asks before
//                       calling Vision and says how many images it will read (--yes answers for you)
// Images:  local-data/receipt-eval/images/*.jpg|jpeg|png|webp       (final: local-data/receipt-eval/final/images/)
// Output:  local-data/receipt-eval/ocr/<image file>.json            (final: .../final/ocr/; existing files are skipped)

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import vision from '@google-cloud/vision';

import { pagesFromAnnotation } from '../src/timetable-vision.js';
import { FINAL_SET, MAIN_SET, listImages } from './receipt-eval-paths.js';

const APP_LIMIT_BYTES = 5 * 1024 * 1024;
const finalSet = process.argv.includes('--final');
const { images: IMAGES, ocr: OCR } = finalSet ? FINAL_SET : MAIN_SET;

mkdirSync(IMAGES, { recursive: true });
mkdirSync(OCR, { recursive: true });

/** Asks before any final-set image goes to Google Vision. */
async function confirmVision(count: number): Promise<boolean> {
  const question = `${count} new final-set image(s) will be read with Google Vision (one request each). Continue? [y/N] `;
  if (process.argv.includes('--yes')) { console.log(`${question}yes (--yes)`); return true; }
  if (!process.stdin.isTTY) {
    console.log(`${question}\nNo terminal to answer in. Run "npm run eval:receipts:final-setup -- --yes" to confirm.`);
    return false;
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await prompt.question(question)).trim());
  } finally {
    prompt.close();
  }
}

const files = listImages(IMAGES).images;
const pendingFiles = files.filter((file) => !existsSync(join(OCR, `${file}.json`)));
if (pendingFiles.length && finalSet && !(await confirmVision(pendingFiles.length))) {
  console.log(`No images were read. ${files.length - pendingFiles.length} already cached, ${pendingFiles.length} waiting.`);
  process.exit(0);
}
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
