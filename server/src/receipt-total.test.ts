import assert from 'node:assert/strict';
import test from 'node:test';

import { receiptRows } from './receipt-layout.js';
import { parseReceiptText } from './receipt-parser.js';
import { extractTotal, isUnpaidDocument } from './receipt-total.js';
import type { OcrPage, OcrWord } from './timetable-parser.js';

// Fictional receipts. `page` lays out printed rows as word boxes, optionally tilted (slope = dy per dx).
// Words are listed in reading order, as Vision does within a block, unless `columns` lists them column by column.
function page(rows: string[][], slope = 0, columns = true): OcrPage[] {
  const words: OcrWord[] = [];
  rows.forEach((cells, row) => cells.forEach((cell, column) => cell.split(' ').forEach((word, offset) => {
    const x = column * 300 + offset * 60;
    const y = row * 30 + x * slope;
    words.push({ text: word, x0: x, y0: y, x1: x + 50, y1: y + 12, block: 1 });
  })));
  // Vision often reads two-column receipts column by column; the parser must not depend on that order.
  return [{ text: '', words: columns ? [...words.filter((word) => word.x0 < 300), ...words.filter((word) => word.x0 >= 300)] : words }];
}
const total = (rows: string[][], slope = 0, text = rows.map((row) => row.join(' ')).join('\n')) =>
  extractTotal(text.split('\n'), receiptRows(page(rows, slope)), text);

test('rows rebuilt from word positions pair "Total" with the amount printed beside it, even on a tilted photo', () => {
  const rows = [['Total', 'RM 46.30'], ['Cash', 'RM 50.00'], ['Change', 'RM 3.70']];
  assert.deepEqual(receiptRows(page(rows)), ['Total RM 46.30', 'Cash RM 50.00', 'Change RM 3.70']);
  // A photo taken at an angle: each row drifts 15 px across the receipt, more than the text height allows.
  const tilted = [['Grand Total Due', 'RM 46.30 MYR'], ['Cash Given Today', 'RM 50.00 MYR'], ['Change Given Back', 'RM 3.70 MYR'], ['Points Earned Today', '46 pts']];
  assert.deepEqual(receiptRows(page(tilted, 0.05, false)), ['Grand Total Due RM 46.30 MYR', 'Cash Given Today RM 50.00 MYR', 'Change Given Back RM 3.70 MYR', 'Points Earned Today 46 pts']);
  // Text in Vision's column order, as the endpoint receives it: labels first, then amounts.
  const columnText = 'Total\nCash\nChange\nRM 46.30\nRM 50.00\nRM 3.70';
  assert.deepEqual(total(rows, 0, columnText), { value: 46.3, review: false });
  // Without word boxes the text order cannot pair them, so the total stays empty for review.
  assert.deepEqual(extractTotal(columnText.split('\n'), [], columnText), { value: null, review: true });
});

test('a final total (net, rounded, grand, final payment) beats a plain total; cash, change, and subtotals never count', () => {
  assert.equal(total([['TOTAL :', 'RM 19.82'], ['ROUNDING :', 'RM -0.02'], ['NET TOTAL :', 'RM 19.80'], ['CASH :', 'RM 50.00'], ['CHANGE', 'RM 30.20']]).value, 19.8);
  assert.equal(total([['Sub Total', '89.70'], ['Service Charge', '0.00']]).value, null);
  assert.equal(total([['ITEM TOTAL', '96.97'], ['GROSS TOTAL :', '96.97'], ['TOTAL RECEIVED AMOUNT', 'RM 100.00'], ['TOTAL ITEMS :', '3']]).value, null);
  // A fuel subsidy receipt: the final payment label, read with a common OCR slip ("Junlah").
  assert.deepEqual(total([['ANDA BAYAR', ''], ['Subsidi Kerajaan', 'RM10.00'], ['Junlah bayaran akhir', 'RM70.00']]), { value: 70, review: false });
});

test('a decimal point lost next to the total label is recovered only with a review warning', () => {
  assert.deepEqual(total([['Total', 'RM 24 60'], ['EDC', 'RM 24.60']]), { value: 24.6, review: true });
  // Elsewhere two numbers are never joined.
  assert.equal(total([['Qty', '24 60']]).value, null);
});

test('an amount only on the next line is never presented as certain when word positions disagree', () => {
  // Positions show "TOTAL" alone on its row; the text order alone suggests 40.00, so it is kept but flagged.
  assert.deepEqual(total([['TOTAL', ''], ['40.00', ''], ['CASH', '']]), { value: 40, review: true });
  // Without positions the long-standing text rule applies: an amount alone below its label.
  assert.deepEqual(extractTotal(['Rounded Total (RM):', '89.70'], [], 'Rounded Total (RM):\n89.70'), { value: 89.7, review: false });
});

test('unpaid orders and outstanding bills have no paid total', () => {
  assert.equal(isUnpaidDocument('ONE CAFE\nUNPAID\nTotal Amount 39.70'), true);
  assert.equal(isUnpaidDocument('BIL ELEKTRIK\nJumlah Perlu Dibayar RM 871.35\nBayar Sebelum 01.07.2026\nTunggakan RM 0.00'), true);
  // One bill-like phrase alone is not enough: paid receipts may print a due date for returns.
  assert.equal(isUnpaidDocument('SHOP\nTOTAL 12.00\nReturn due date 30/10/2026'), false);
  const bill = parseReceiptText('BIL ELEKTRIK\nJumlah Perlu Dibayar RM 871.35\nBayar Sebelum 01.07.2026\nTunggakan RM 0.00');
  assert.equal(bill.totalAmount, null);
  assert.ok(bill.warnings.includes('Total amount needs review.'));
});

test('the endpoint parser uses word boxes when given and still works from text alone', () => {
  const rows = [['KEDAI MAJU SDN BHD', ''], ['Total', 'RM 12.50'], ['Cash', 'RM 20.00']];
  const text = 'KEDAI MAJU SDN BHD\nTotal\nCash\nRM 12.50\nRM 20.00';
  assert.equal(parseReceiptText(text, page(rows)).totalAmount, 12.5);
  assert.equal(parseReceiptText(text).totalAmount, null);
  assert.equal(parseReceiptText('Shop\nTOTAL RM 7.00').totalAmount, 7);
});

test('a receipt photographed sideways still pairs each label with the amount on its printed row', () => {
  const rows = [['KEDAI CONTOH ENTERPRISE', ''], ['Subtotal', 'RM 18.40'], ['Rounding', 'RM 0.00'], ['Grand Total', 'RM 18.40'], ['Cash Given', 'RM 20.00']];
  const upright = page(rows, 0, false)[0]!.words;
  // Turned clockwise, text reads down the image; turned anticlockwise, it reads up. Words become tall and narrow.
  const clockwise = upright.map((word) => ({ ...word, x0: 1000 - word.y1, x1: 1000 - word.y0, y0: word.x0, y1: word.x1 }));
  const anticlockwise = upright.map((word) => ({ ...word, x0: word.y0, x1: word.y1, y0: 2000 - word.x1, y1: 2000 - word.x0 }));
  const expected = ['KEDAI CONTOH ENTERPRISE', 'Subtotal RM 18.40', 'Rounding RM 0.00', 'Grand Total RM 18.40', 'Cash Given RM 20.00'];
  assert.deepEqual(receiptRows([{ text: '', words: clockwise }]), expected);
  assert.deepEqual(receiptRows([{ text: '', words: anticlockwise }]), expected);
  assert.deepEqual(receiptRows(page(rows)), expected);
});

test('"Total Payment", a total including tax, and an OCR slip in "Total" are read as the paid total', () => {
  assert.deepEqual(total([['Subtotal', 'RM 30.18'], ['Rounding Adjustment', 'RM 0.02'], ['Total Payment (Rounding)', 'RM 30.20']]), { value: 30.2, review: false });
  // The amount before an app discount is printed as plain "TOTAL"; the paid amount includes tax.
  assert.deepEqual(total([['TOTAL', '15.00'], ['App Deals', '-3.00'], ['Takeaway Tctal (incl Tax)', '12.00'], ['Visa', '12.00']]), { value: 12, review: false });
});

test('without a total label, a card or e-wallet charge (or cash minus change) is used, always for review', () => {
  assert.deepEqual(total([['Sub Total', '43.77'], ['Disc : 0.00', 'RM 43.75'], ['DUITNOW :', '43.75']]), { value: 43.75, review: true });
  assert.deepEqual(total([['Item one', '5.00'], ['Payment detail', ''], ['1.Touch n Go', '5.00']]), { value: 5, review: true });
  assert.deepEqual(total([['Rounding Adjustment', '0.00'], ['CASH', '104.50'], ['CHANGE', '50.00']]), { value: 54.5, review: true });
  // Card numbers, approvals, and points are never amounts; cash alone (it includes change) is never used.
  assert.equal(total([['Sub Total', '30.00'], ['VISA Card No. 4000******1234', ''], ['Points Earned', '30.00']]).value, null);
  assert.equal(total([['CASH', '50.00']]).value, null);
});

test('a labelled total that disagrees with the card or e-wallet charge is flagged, not trusted', () => {
  assert.deepEqual(total([['Total', 'RM20.00'], ['Touch n Go', 'RM20 90']]), { value: 20, review: true });
  assert.deepEqual(total([['Total', 'RM 12.50'], ['Visa', 'RM 12.50']]), { value: 12.5, review: false });
});
