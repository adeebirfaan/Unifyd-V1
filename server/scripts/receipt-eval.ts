// Scores the receipt parser against hand-made labels, using cached OCR only (no network).
// Usage (from server/):
//   npm run eval:receipts            development split: scores and every wrong field
//   npm run eval:receipts -- --final held-out test split as well (use only for the final score)
//   npm run eval:receipts -- --json  machine-readable output for the thesis appendix

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FIELDS, groupBy, parseLabelsCsv, scoreReceipt, summarize } from '../src/receipt-eval.js';
import type { GroupStats, ScoredReceipt } from '../src/receipt-eval.js';
import { parseReceiptText } from '../src/receipt-parser.js';
import type { OcrPage } from '../src/timetable-parser.js';
import { LABELS, OCR } from './receipt-eval-paths.js';

const final = process.argv.includes('--final');
const json = process.argv.includes('--json');

if (!existsSync(LABELS)) {
  console.error('No labels.csv yet. Run "npm run eval:receipts:run" to create it.');
  process.exit(1);
}
let parsed: ReturnType<typeof parseLabelsCsv>;
try {
  parsed = parseLabelsCsv(readFileSync(LABELS, 'utf8'));
} catch (error) {
  console.error(`labels.csv: ${(error as Error).message}`);
  process.exit(1);
}
const { labels, pending } = parsed;
if (!labels.length) {
  console.log(`No labelled receipts yet (${pending.length} waiting). Fill in server/${LABELS}, then run this again.`);
  process.exit(0);
}
const missing: string[] = [];
const scored: ScoredReceipt[] = [];
for (const label of labels) {
  const cache = join(OCR, `${label.file}.json`);
  if (!existsSync(cache)) { missing.push(label.file); continue; }
  // The same input the receipt endpoint gives the parser: text and word boxes from one Vision call.
  const { text, pages } = JSON.parse(readFileSync(cache, 'utf8')) as { text: string; pages?: OcrPage[] };
  scored.push(scoreReceipt(label, parseReceiptText(text, pages)));
}

const dev = scored.filter((receipt) => receipt.split === 'dev');
const test = scored.filter((receipt) => receipt.split === 'test');
const report = (receipts: ScoredReceipt[]) => ({
  overall: summarize(receipts),
  byType: Object.fromEntries([...groupBy(receipts, (r) => r.label.type)].map(([key, group]) => [key, summarize(group)])),
  byCondition: Object.fromEntries([...groupBy(receipts, (r) => r.label.condition)].map(([key, group]) => [key, summarize(group)])),
});

if (json) {
  console.log(JSON.stringify({ labelled: labels.length, waitingForLabels: pending.length, missingOcr: missing, dev: report(dev), ...(final ? { test: report(test) } : {}) }, null, 2));
  process.exit(0);
}

const row = (name: string, stats: GroupStats) => [
  name.padEnd(16), String(stats.count).padStart(3),
  ...FIELDS.map((field) => `${stats.fields[field].accuracy.toFixed(1).padStart(6)}%`),
  `${stats.allCorrectRate.toFixed(1).padStart(6)}%`,
  String(FIELDS.reduce((sum, field) => sum + stats.fields[field].silent, 0)).padStart(7),
].join('  ');
const table = (title: string, receipts: ScoredReceipt[]) => {
  const { overall, byType, byCondition } = report(receipts);
  console.log(`\n${title}`);
  console.log(['group'.padEnd(16), '  n', 'merchant', '   date', '  total', ' all 3', ' silent'].join('  '));
  console.log(row('overall', overall));
  for (const [key, stats] of Object.entries(byType)) console.log(row(`  ${key}`, stats));
  for (const [key, stats] of Object.entries(byCondition)) console.log(row(`  ${key}`, stats));
};

console.log(`\n${labels.length} labelled receipts: ${dev.length} development, ${test.length} held-out test${missing.length ? `, ${missing.length} without cached OCR` : ''}${pending.length ? `; ${pending.length} still waiting for labels` : ''}.`);
if (missing.length) console.log(`Run "npm run eval:receipts:ocr" for: ${missing.join(', ')}`);
table('DEVELOPMENT SPLIT', dev);
if (final) table('HELD-OUT TEST SPLIT (final score)', test);
else console.log(`\nThe ${test.length} held-out receipts are hidden. Use --final only when reporting the final result.`);

// Wrong fields are listed for the development split only, so the test split stays unseen.
const wrong = dev.filter((receipt) => FIELDS.some((field) => receipt.outcomes[field] !== 'correct'));
if (wrong.length) {
  console.log('\nWRONG FIELDS (development split)  [silent = wrong with no review warning]');
  for (const receipt of wrong) {
    const want = { merchant: receipt.label.merchant, date: receipt.label.date, total: receipt.label.total };
    const details = FIELDS.filter((field) => receipt.outcomes[field] !== 'correct')
      .map((field) => `${field} ${receipt.outcomes[field]}: want ${JSON.stringify(want[field])}, got ${JSON.stringify(receipt.got[field])}`);
    console.log(`  ${receipt.label.file} (${receipt.label.type}, ${receipt.label.condition})\n    ${details.join('\n    ')}`);
  }
}
