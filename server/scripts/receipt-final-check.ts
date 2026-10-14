// Checks the final test set's labels.csv format: types, conditions, dates, totals, and missing or unknown files.
// Usage (from server/): npm run eval:receipts:final-check
// It never runs the parser and never opens cached OCR (only lists which files exist), so it shows no results.

import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';

import { checkLabels, formatLabelCheck, labelsReady } from '../src/receipt-label-check.js';
import { FINAL_SET, listImages } from './receipt-eval-paths.js';

if (!existsSync(FINAL_SET.labels)) {
  console.error(`No server/${FINAL_SET.labels} yet. Add photos to server/${FINAL_SET.images}, then run "npm run eval:receipts:final-setup".`);
  process.exit(1);
}
mkdirSync(FINAL_SET.images, { recursive: true });
const cached = new Set(existsSync(FINAL_SET.ocr) ? readdirSync(FINAL_SET.ocr).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -'.json'.length)) : []);
const check = checkLabels(readFileSync(FINAL_SET.labels, 'utf8'), { ...listImages(FINAL_SET.images), cached });
console.log(formatLabelCheck(check, FINAL_SET.labels));
if (!labelsReady(check)) process.exitCode = 1;
