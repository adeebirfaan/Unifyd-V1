import assert from 'node:assert/strict';
import test from 'node:test';

import { isTestSample, merchantMatches, parseLabelsCsv, scoreReceipt, summarize } from './receipt-eval.js';
import type { ReceiptResult } from './receipt-parser.js';

const HEADER = 'file,type,condition,merchant,date,total';
const result = (merchantName: string | null, purchaseDate: string | null, totalAmount: number | null, warnings: string[] = []): ReceiptResult =>
  ({ merchantName, purchaseDate, totalAmount, rawText: '', warnings });

test('labels CSV reads quoted names, blanks, RM amounts, and comments', () => {
  const labels = parseLabelsCsv([
    '# guide line',
    HEADER,
    'r001.jpg,chain_retail,clean,KK Mart,2026-10-12,5.70',
    'r002.jpg,local_shop,hard,"Kedai Ali, Pekan",,RM 9.00',
    '',
  ].join('\n'));
  assert.deepEqual(labels, [
    { file: 'r001.jpg', type: 'chain_retail', condition: 'clean', merchant: 'KK Mart', date: '2026-10-12', total: 5.7 },
    { file: 'r002.jpg', type: 'local_shop', condition: 'hard', merchant: 'Kedai Ali, Pekan', date: null, total: 9 },
  ]);
});

test('labels CSV rejects invalid rows with their line number', () => {
  assert.throws(() => parseLabelsCsv('file,merchant\n'), /first row/);
  assert.throws(() => parseLabelsCsv(`${HEADER}\nr1.jpg,shop,clean,A,2026-10-12,1`), /Line 2: type/);
  assert.throws(() => parseLabelsCsv(`${HEADER}\nr1.jpg,other,clean,A,12/10/2026,1`), /Line 2: date/);
  assert.throws(() => parseLabelsCsv(`${HEADER}\nr1.jpg,other,clean,A,,-3`), /Line 2: total/);
  assert.throws(() => parseLabelsCsv(`${HEADER}\nr1.jpg,other,clean,A,,1\nr1.jpg,other,clean,A,,1`), /duplicate/);
});

test('merchant matches when the parsed words begin with the label, ignoring company suffixes', () => {
  assert.equal(merchantMatches('TEALIVE @ UMP PEKAN', 'Tealive'), true);
  assert.equal(merchantMatches('MYDIN MOHAMED HOLDINGS BHD', 'Mydin Mohamed Holdings Sdn. Bhd.'), true);
  assert.equal(merchantMatches('WELCOME TO MYDIN', 'Mydin'), false);
  assert.equal(merchantMatches('KK', 'KK Mart'), false);
  assert.equal(merchantMatches(null, 'KK Mart'), false);
  assert.equal(merchantMatches(null, null), true);
});

test('each field is correct, wrong but flagged for review, or silently wrong', () => {
  const label = { file: 'a.jpg', type: 'chain_retail', condition: 'clean', merchant: 'KK Mart', date: '2026-10-12', total: 5.7 } as const;
  const scored = scoreReceipt(label, result('KK MART', null, 2, ['Purchase date needs review.']));
  assert.deepEqual(scored.outcomes, { merchant: 'correct', date: 'flagged', total: 'silent' });
  assert.deepEqual(scoreReceipt(label, result('KK Mart', '2026-10-12', 5.7)).outcomes, { merchant: 'correct', date: 'correct', total: 'correct' });
});

test('summary reports per-field accuracy and fully correct receipts', () => {
  const label = { file: 'a.jpg', type: 'other', condition: 'clean', merchant: 'A', date: null, total: 1 } as const;
  const stats = summarize([
    scoreReceipt(label, result('A', null, 1)),
    scoreReceipt({ ...label, file: 'b.jpg' }, result('A', null, 2)),
    scoreReceipt({ ...label, file: 'c.jpg' }, result('B', null, 1)),
  ]);
  assert.equal(stats.count, 3);
  assert.deepEqual(stats.fields.total, { correct: 2, flagged: 0, silent: 1, accuracy: 66.7 });
  assert.equal(stats.fields.date.accuracy, 100);
  assert.equal(stats.allCorrect, 1);
  assert.equal(stats.allCorrectRate, 33.3);
});

test('the held-out split is stable and close to 20%', () => {
  const files = Array.from({ length: 1000 }, (_, i) => `receipt-${i}.jpg`);
  const held = files.filter(isTestSample).length;
  assert.ok(held > 150 && held < 250, `held out ${held} of 1000`);
  assert.equal(isTestSample('receipt-7.jpg'), isTestSample('receipt-7.jpg'));
});
