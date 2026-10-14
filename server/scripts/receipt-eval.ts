// Scores the receipt parser against hand-made labels, using cached OCR only (no network).
// Usage (from server/):
//   npm run eval:receipts            development split: scores and every wrong field
//   npm run eval:receipts -- --final held-out test split, the final test set (final/), and both combined
//                                    (use only once, for the final reported score)
//   npm run eval:receipts -- --json  machine-readable output for the thesis appendix

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseLabelsCsv, scoreReceipt } from '../src/receipt-eval.js';
import type { ReceiptLabel, ScoredReceipt } from '../src/receipt-eval.js';
import { FinalSetNotReadyError, receiptEvalReport } from '../src/receipt-eval-report.js';
import type { LoadedSet } from '../src/receipt-eval-report.js';
import { parseReceiptText } from '../src/receipt-parser.js';
import type { OcrPage } from '../src/timetable-parser.js';
import { FINAL_SET, MAIN_SET } from './receipt-eval-paths.js';
import type { EvalSetPaths } from './receipt-eval-paths.js';

const final = process.argv.includes('--final');
const json = process.argv.includes('--json');

/** Parses each labelled receipt's cached OCR, exactly as the endpoint does, and scores it. */
function score(paths: EvalSetPaths, labels: ReceiptLabel[]): { scored: ScoredReceipt[]; missing: string[] } {
  const missing: string[] = [];
  const scored: ScoredReceipt[] = [];
  for (const label of labels) {
    const cache = join(paths.ocr, `${label.file}.json`);
    if (!existsSync(cache)) { missing.push(label.file); continue; }
    // The same input the receipt endpoint gives the parser: text and word boxes from one Vision call.
    const { text, pages } = JSON.parse(readFileSync(cache, 'utf8')) as { text: string; pages?: OcrPage[] };
    scored.push(scoreReceipt(label, parseReceiptText(text, pages)));
  }
  return { scored, missing };
}

if (!existsSync(MAIN_SET.labels)) {
  console.error('No labels.csv yet. Run "npm run eval:receipts:run" to create it.');
  process.exit(1);
}
let parsed: ReturnType<typeof parseLabelsCsv>;
try {
  parsed = parseLabelsCsv(readFileSync(MAIN_SET.labels, 'utf8'));
} catch (error) {
  console.error(`labels.csv: ${(error as Error).message}`);
  process.exit(1);
}
const { labels, pending } = parsed;
if (!labels.length) {
  console.log(`No labelled receipts yet (${pending.length} waiting). Fill in server/${MAIN_SET.labels}, then run this again.`);
  process.exit(0);
}
const main: LoadedSet = { labels, pending, ...score(MAIN_SET, labels) };

// Called by the report only for --final; a normal run never opens the final folder.
const loadFinal = (): LoadedSet => {
  if (!existsSync(FINAL_SET.labels)) throw new FinalSetNotReadyError(`No server/${FINAL_SET.labels} yet. Run "npm run eval:receipts:final-setup".`);
  let finalLabels: ReturnType<typeof parseLabelsCsv>;
  try {
    finalLabels = parseLabelsCsv(readFileSync(FINAL_SET.labels, 'utf8'));
  } catch (error) {
    throw new FinalSetNotReadyError(`final/labels.csv: ${(error as Error).message}. Run "npm run eval:receipts:final-check".`);
  }
  return { ...finalLabels, ...score(FINAL_SET, finalLabels.labels) };
};

try {
  console.log(receiptEvalReport({ final, json }, main, loadFinal));
} catch (error) {
  if (!(error instanceof FinalSetNotReadyError)) throw error;
  console.error(`${error.message}\nNothing was scored, so the --final run is still unused.`);
  process.exit(1);
}
