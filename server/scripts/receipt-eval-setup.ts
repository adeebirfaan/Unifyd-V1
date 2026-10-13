// Prepares the evaluation folders and adds an empty labels.csv row for every new image.
// Usage (from server/): npm run eval:receipts:setup   (also the first step of eval:receipts:run)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { addPendingRows, parseLabelsCsv } from '../src/receipt-eval.js';
import { IMAGES, LABELS, OCR, TEMPLATE, listImages } from './receipt-eval-paths.js';

mkdirSync(IMAGES, { recursive: true });
mkdirSync(OCR, { recursive: true });

const { images, unsupported } = listImages();
const existing = existsSync(LABELS) ? readFileSync(LABELS, 'utf8') : null;
const { csv, added } = addPendingRows(existing, readFileSync(TEMPLATE, 'utf8'), images);
if (csv !== existing) writeFileSync(LABELS, csv);

const { labels, pending } = parseLabelsCsv(csv);
const missing = [...labels.map((label) => label.file), ...pending].filter((file) => !images.includes(file));
console.log(`Images folder: server/${IMAGES}`);
console.log(`${images.length} images, ${labels.length} labelled, ${pending.length} waiting for labels${added.length ? ` (${added.length} new rows added to labels.csv)` : ''}.`);
if (unsupported.length) console.log(`Skipped (save as JPEG, PNG, or WEBP; on iPhone set Camera > Formats > Most Compatible): ${unsupported.join(', ')}`);
if (missing.length) console.log(`labels.csv lists files that are not in the images folder: ${missing.join(', ')}`);
if (!images.length) console.log('Add receipt photos to the images folder, then run "npm run eval:receipts:run" again.');
else if (pending.length) console.log(`Fill in the empty rows in server/${LABELS} (open it in Excel or VS Code).`);
