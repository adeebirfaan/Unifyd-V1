import assert from 'node:assert/strict';
import test from 'node:test';

import { extractDate } from './receipt-date.js';
import { parseReceiptText } from './receipt-parser.js';

// Fictional receipts.
const date = (text: string, rows: string[] = []) => extractDate(text.split('\n'), rows);

test('Malaysian month-name dates under a date label or beside a time are confident', () => {
  assert.deepEqual(date('757306\nDATE\n:04/Aug/2025 01:45:16'), { value: '2025-08-04', review: false });
  assert.deepEqual(date('STATION\nDATE\n:05 JUN 2025'), { value: '2025-06-05', review: false });
  assert.deepEqual(date('Tarikh\n: 12 Okt 2025'), { value: '2025-10-12', review: false });
  assert.deepEqual(date('30/Sep/2025 07:45:44'), { value: '2025-09-30', review: false });
  assert.deepEqual(date('Date: 13/10/2025 12:55:52'), { value: '2025-10-13', review: false });
});

test('a month misread with a digit is recovered only inside a date, and always flagged', () => {
  assert.deepEqual(date('PETRONAS\n100CT2026 09:17PM'), { value: '2026-10-10', review: true });
  // Not a date pattern: no recovery.
  assert.deepEqual(date('Ref 0CT 55'), { value: null, review: true });
});

test('dates beside due, pay-before, or expiry labels are never the purchase date', () => {
  const bill = 'BIL ELEKTRIK\nTarikh Bil 17 Jun 2026\nBayar Sebelum 17.07.2026\nTempoh Bil 17.05.2026 - 16.06.2026';
  assert.equal(date(bill, bill.split('\n')).value, '2026-06-17');
  assert.deepEqual(date('Card expiry 12/28\nValid until 31/12/2026'), { value: null, review: true });
});

test('a date with no label or time, or a two-digit year, is kept but flagged', () => {
  assert.deepEqual(date('KEDAI\n16/01/2026 12 20'), { value: '2026-01-16', review: true });
  assert.deepEqual(date('M/S KEDAI\nDate:\nNo. 1\n11/8/23'), { value: '2023-08-11', review: true });
  // Impossible dates are never produced.
  assert.equal(date('Shop\n31/02/2026 10:00').value, null);
});

test('the parser reports date review through the existing warning text', () => {
  const result = parseReceiptText('PETRONAS\n100CT2026 09:17PM\nTotal RM 50.00');
  assert.equal(result.purchaseDate, '2026-10-10');
  assert.ok(result.warnings.includes('Purchase date needs review.'));
  assert.ok(!parseReceiptText('SHOP SDN BHD\nDate: 13/10/2025 12:55\nTOTAL RM 5.00').warnings.includes('Purchase date needs review.'));
});
