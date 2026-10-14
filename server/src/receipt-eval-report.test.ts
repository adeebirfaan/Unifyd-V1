import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { isTestSample, readLabelsCsv, scoreReceipt, warningBreakdown } from './receipt-eval.js';
import type { ReceiptLabel } from './receipt-eval.js';
import { FinalSetNotReadyError, receiptEvalReport } from './receipt-eval-report.js';
import type { LoadedSet } from './receipt-eval-report.js';
import { checkLabels, formatLabelCheck, labelsReady } from './receipt-label-check.js';
import type { ReceiptResult } from './receipt-parser.js';

const HEADER = 'file,type,condition,merchant,date,total';
const result = (merchantName: string | null, purchaseDate: string | null, totalAmount: number | null, warnings: string[] = []): ReceiptResult =>
  ({ merchantName, purchaseDate, totalAmount, rawText: '', warnings });
const label = (file: string, overrides: Partial<ReceiptLabel> = {}): ReceiptLabel =>
  ({ file, type: 'chain_retail', condition: 'clean', merchant: 'KK Mart', date: '2026-10-12', total: 5.7, ...overrides });

// File names whose stable hash puts them in the development or held-out split.
const names = (wantTest: boolean, count: number) => Array.from({ length: 400 }, (_, index) => `main-${index}.jpg`).filter((file) => isTestSample(file) === wantTest).slice(0, count);
const [devA, devB] = names(false, 2) as [string, string];
const [heldOutA] = names(true, 1) as [string];

function mainSet(): LoadedSet {
  const labels = [label(devA), label(devB, { type: 'local_shop', condition: 'hard' }), label(heldOutA)];
  return { labels, pending: [], missing: [], scored: [
    scoreReceipt(labels[0]!, result('KK Mart', '2026-10-12', 5.7)),
    scoreReceipt(labels[1]!, result('Wrong Shop', null, 5.7, ['Purchase date needs review.'])),
    scoreReceipt(labels[2]!, result('KK Mart', '2026-10-12', 9.99)),
  ] };
}
function finalSet(): LoadedSet {
  const labels = [label('FINAL-SECRET-1.jpg', { merchant: 'Secret Bakery' }), label('FINAL-SECRET-2.jpg', { type: 'handwritten', condition: 'hard', merchant: 'Secret Kedai' })];
  return { labels, pending: [], missing: [], scored: [
    scoreReceipt(labels[0]!, result('Secret Bakery', '2026-10-12', 5.7, ['Total amount needs review.'])),
    scoreReceipt(labels[1]!, result('Other Name', '2026-10-12', null, ['Merchant name needs review.', 'Total amount needs review.'])),
  ] };
}

test('a normal run never loads, scores, or prints the final set', () => {
  let loads = 0;
  const loadFinal = () => { loads++; return finalSet(); };
  const text = receiptEvalReport({ final: false, json: false }, mainSet(), loadFinal);
  const json = receiptEvalReport({ final: false, json: true }, mainSet(), loadFinal);
  assert.equal(loads, 0);
  for (const output of [text, json]) {
    assert.doesNotMatch(output, /FINAL-SECRET|Secret|FINAL TEST SET|COMBINED/i);
    assert.doesNotMatch(output, new RegExp(heldOutA));
  }
  assert.match(text, /DEVELOPMENT SPLIT/);
  assert.match(text, /The 1 held-out receipts are hidden/);
  assert.deepEqual(Object.keys(JSON.parse(json)), ['labelled', 'waitingForLabels', 'missingOcr', 'dev']);
});

test('--final reports the held-out split, the final set, and both combined, each with type, condition, and warning rows', () => {
  const text = receiptEvalReport({ final: true, json: false }, mainSet(), finalSet);
  const titles = ['DEVELOPMENT SPLIT', 'HELD-OUT TEST SPLIT (final score, 1 receipts)', 'FINAL TEST SET (final score, 2 receipts)', 'HELD-OUT + FINAL COMBINED (final score, 3 receipts)'];
  const positions = titles.map((title) => text.indexOf(title));
  assert.ok(positions.every((position) => position >= 0), text);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  const section = (index: number) => text.slice(positions[index]!, positions[index + 1] ?? text.indexOf('WRONG FIELDS'));
  for (const index of [1, 2, 3]) {
    assert.match(section(index), /group\s+n\s+merchant\s+date\s+total\s+all 3\s+silent/);
    assert.match(section(index), /^overall /m);
    assert.match(section(index), /^ {2}chain_retail /m);
    assert.match(section(index), /^ {2}clean /m);
    assert.match(section(index), /correct, no warning\s+correct, warned\s+wrong, flagged\s+wrong, silent\s+blank/);
    for (const field of ['merchant', 'date', 'total']) assert.match(section(index), new RegExp(`^ {2}${field} +\\d`, 'm'));
  }
  // Final set: merchant 1 correct + 1 wrong flagged; total 1 correct with warning + 1 blank.
  assert.match(section(2), /^ {2}merchant +1 +0 +1 +0 +0$/m);
  assert.match(section(2), /^ {2}total +0 +1 +0 +0 +1$/m);
  assert.match(section(3), /^overall +3 /m);
  assert.match(section(2), /^ {2}handwritten /m);
  // Per-receipt details stay limited to the development split.
  assert.doesNotMatch(text, /FINAL-SECRET|Other Name/);
  assert.doesNotMatch(text, new RegExp(heldOutA));

  const json = JSON.parse(receiptEvalReport({ final: true, json: true }, mainSet(), finalSet));
  assert.deepEqual(Object.keys(json), ['labelled', 'waitingForLabels', 'missingOcr', 'dev', 'test', 'finalSet', 'combined']);
  assert.equal(json.combined.overall.count, 3);
  assert.deepEqual(json.finalSet.warnings.total, { correctNoWarning: 0, correctWithWarning: 1, wrongFlagged: 0, wrongSilent: 0, blank: 1 });
});

test('--final stops before printing anything when the final set is incomplete', () => {
  const incomplete = (changes: Partial<LoadedSet>) => () => ({ ...finalSet(), ...changes });
  for (const loadFinal of [incomplete({ pending: ['new.jpg'] }), incomplete({ missing: ['FINAL-SECRET-1.jpg'] }), incomplete({ labels: [], scored: [] })]) {
    assert.throws(() => receiptEvalReport({ final: true, json: false }, mainSet(), loadFinal), FinalSetNotReadyError);
  }
});

test('the warning breakdown puts every receipt in exactly one kind', () => {
  const scored = finalSet().scored.concat(mainSet().scored);
  for (const field of ['merchant', 'date', 'total'] as const) {
    const counts = warningBreakdown(scored, field);
    assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), scored.length);
  }
  assert.deepEqual(warningBreakdown(mainSet().scored, 'date'), { correctNoWarning: 2, correctWithWarning: 0, wrongFlagged: 0, wrongSilent: 0, blank: 1 });
  assert.deepEqual(warningBreakdown(mainSet().scored, 'total'), { correctNoWarning: 2, correctWithWarning: 0, wrongFlagged: 0, wrongSilent: 1, blank: 0 });
});

test('readLabelsCsv lists every invalid row instead of stopping at the first', () => {
  const { labels, pending, errors } = readLabelsCsv([HEADER, 'a.jpg,shop,clean,A,,1', 'b.jpg,other,soft,B,,1', 'c.jpg,other,clean,C,31/02/2026,1',
    'd.jpg,other,clean,D,,-3', 'a.jpg,,,,,', 'e.jpg,other,hard,E,2026-10-01,RM 4.20', 'f.jpg'].join('\n'));
  assert.deepEqual(errors.map((error) => error.split(':')[0]), ['Line 2', 'Line 3', 'Line 4', 'Line 5', 'Line 6']);
  assert.match(errors[0]!, /type must be one of/);
  assert.match(errors[4]!, /duplicate file a\.jpg/);
  assert.deepEqual(labels.map((entry) => entry.file), ['e.jpg']);
  assert.deepEqual(pending, ['f.jpg']);
  assert.deepEqual(readLabelsCsv('file,type\nx.jpg,other').errors, [`The first row must be: ${HEADER}`]);
});

test('the final label check reports format and file problems only, never parser output', () => {
  const csv = [HEADER, 'r1.jpg,chain_retail,clean,Secret Bakery,2026-10-12,5.70', 'r2.jpg,local_shop,hard,"Kedai, Pekan",13/10/2026,12', 'r3.jpg,food,clean,X,,1',
    'r4.jpg,other,clean,Y,2026-13-01,1', 'r5.jpg,other,clean,Z,,abc', 'gone.jpg,other,clean,W,,1', 'r6.jpg,,,,,'].join('\n');
  const check = checkLabels(csv, { images: ['r1.jpg', 'r2.jpg', 'r3.jpg', 'r4.jpg', 'r5.jpg', 'r6.jpg', 'extra.jpg'], unsupported: ['IMG_1.HEIC'], cached: new Set(['r1.jpg']) });
  assert.equal(check.errors.length, 3);
  assert.deepEqual(check.unknownFiles, ['gone.jpg']);
  assert.deepEqual(check.unlistedImages, ['extra.jpg']);
  assert.deepEqual(check.pending, ['r6.jpg']);
  assert.equal(check.cached, 1);
  assert.equal(labelsReady(check), false);
  const text = formatLabelCheck(check, 'final/labels.csv');
  assert.match(text, /format only; the parser is not run/);
  assert.match(text, /Line 4: type must be one of/);
  assert.match(text, /IMG_1\.HEIC/);
  // No merchant, date, or total values (labelled or parsed), and no accuracy or outcome words.
  assert.doesNotMatch(text, /Secret|Kedai|5\.70|2026-10-12|%|correct|flagged|silent|accuracy/i);

  const ready = checkLabels([HEADER, 'r1.jpg,chain_retail,clean,A,2026-10-12,5.70'].join('\n'), { images: ['r1.jpg'], unsupported: [], cached: new Set(['r1.jpg']) });
  assert.equal(labelsReady(ready), true);
  assert.match(formatLabelCheck(ready, 'final/labels.csv'), /Labels OK/);
});

test('the label check code cannot reach the parser or cached OCR text', () => {
  for (const path of ['src/receipt-label-check.ts', 'scripts/receipt-final-check.ts']) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /receipt-parser|parseReceiptText|scoreReceipt|receipt-eval-report|summarize/, path);
  }
  // The check script lists OCR file names; the only file it reads is labels.csv.
  const script = readFileSync('scripts/receipt-final-check.ts', 'utf8');
  assert.deepEqual(script.match(/readFileSync\([^)]*\)/g), ['readFileSync(FINAL_SET.labels, \'utf8\')']);
});

test('normal evaluation scripts never refer to the final set folder', () => {
  // Only receipt-eval.ts opens FINAL_SET, and only inside loadFinal (called by the report for --final).
  const evalScript = readFileSync('scripts/receipt-eval.ts', 'utf8');
  const loadFinal = evalScript.slice(evalScript.indexOf('const loadFinal'), evalScript.indexOf('console.log(receiptEvalReport'));
  assert.ok(loadFinal.includes('FINAL_SET.labels'));
  assert.equal(evalScript.split('FINAL_SET').length, loadFinal.split('FINAL_SET').length + 1); // + the import line
  // Setup and OCR caching pick the final folders only with --final.
  for (const path of ['scripts/receipt-eval-setup.ts', 'scripts/receipt-ocr-cache.ts']) {
    assert.match(readFileSync(path, 'utf8'), /const finalSet = process\.argv\.includes\('--final'\);\r?\nconst \{[^}]+\} = finalSet \? FINAL_SET : MAIN_SET;/, path);
  }
});
