// Times the receipt parser alone on cached OCR (no network, no Google Vision). Development receipts only: held-out
// receipts are skipped with the evaluation's own hash, and the final set is never read. Nothing is written.
// Usage (from server/): npm run timing:receipts:parse

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isTestSample, parseLabelsCsv } from '../src/receipt-eval.js';
import { withReceiptItems } from '../src/receipt-items.js';
import { parseReceiptText } from '../src/receipt-parser.js';
import type { OcrPage } from '../src/timetable-parser.js';
import { MAIN_SET } from './receipt-eval-paths.js';

const RUNS = 50;
const percentile = (values: number[], share: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * share))]!;
const ms = (value: number) => `${value.toFixed(2)} ms`;

const { labels } = parseLabelsCsv(readFileSync(MAIN_SET.labels, 'utf8'));
const receipts = labels.filter((label) => !isTestSample(label.file)).flatMap((label) => {
  const cache = join(MAIN_SET.ocr, `${label.file}.json`);
  if (!existsSync(cache)) return [];
  const { text, pages } = JSON.parse(readFileSync(cache, 'utf8')) as { text: string; pages?: OcrPage[] };
  return [{ text, pages, words: (pages ?? []).reduce((sum, page) => sum + page.words.length, 0) }];
});

const time = (run: () => unknown) => { const start = performance.now(); run(); return performance.now() - start; };
// The first call per receipt includes JIT warm-up, as on a server that has just started.
const coldParse = receipts.map(({ text, pages }) => time(() => parseReceiptText(text, pages)));
const warmParse: number[] = [];
const warmItems: number[] = [];
for (const { text, pages } of receipts) {
  const parseRuns: number[] = [];
  const itemRuns: number[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    let parsed!: ReturnType<typeof parseReceiptText>;
    parseRuns.push(time(() => { parsed = parseReceiptText(text, pages); }));
    itemRuns.push(time(() => withReceiptItems(parsed, pages)));
  }
  warmParse.push(percentile(parseRuns, 0.5));
  warmItems.push(percentile(itemRuns, 0.5));
}

const words = receipts.map((receipt) => receipt.words);
console.log(`${receipts.length} development receipts (cached OCR; ${percentile(words, 0.5)} words median, ${Math.max(...words)} max). ${RUNS} warm runs each.`);
console.log(`parse  first call: median ${ms(percentile(coldParse, 0.5))}, p95 ${ms(percentile(coldParse, 0.95))}, max ${ms(Math.max(...coldParse))}, sum ${ms(coldParse.reduce((a, b) => a + b, 0))}`);
console.log(`parse  warm:       median ${ms(percentile(warmParse, 0.5))}, p95 ${ms(percentile(warmParse, 0.95))}, max ${ms(Math.max(...warmParse))}`);
console.log(`items  warm:       median ${ms(percentile(warmItems, 0.5))}, p95 ${ms(percentile(warmItems, 0.95))}, max ${ms(Math.max(...warmItems))}`);
