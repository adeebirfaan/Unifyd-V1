import assert from 'node:assert/strict';
import test from 'node:test';

import { ITEMS_INCOMPLETE, cleanName, extractItems, isExcludedLine, isTruncatedLabel, readItems, withReceiptItems } from './receipt-items.js';
import { parseReceiptText } from './receipt-parser.js';
import type { OcrPage } from './timetable-parser.js';

// Every receipt line below is synthetic: made-up shops, products, people, and numbers, with barcodes from the
// in-store 200… range. Each keeps the printed shape of a case the rules handle.
const lines = (...rows: string[]) => rows.join('\n');
const items = (text: string, total: number | null, pages?: OcrPage[]) => extractItems(text, pages, total);

test('two-line items pair each name with its "qty × unit amount" line, with quantities and unit prices', () => {
  const text = lines(
    'KEDAI RUNCIT CONTOH', '100001 (STAFF A) 01/01/2026 10:00:00',
    'SAMPLE POTATO CHIPS - 1KG', '2000000000011 PKT 1x7.49 7.49',
    'SAMPLE EGGS GRADE B', '2000000000028 TRAY 2x12.50 25.00',
    'SAMPLE BAG ROLL 28X35', '2000000000035 PKT 1x8.90 8.90', '2000000000035 PKT 1x8.90 8.90',
    'Item 4 SubTotal 50.29', 'Total 50.29', 'Cash 60.00', 'Change 9.71',
  );
  assert.deepEqual(items(text, 50.29), { incomplete: false, items: [
    { name: 'SAMPLE POTATO CHIPS - 1KG', quantity: 1, unitPrice: 7.49, amount: 7.49 },
    { name: 'SAMPLE EGGS GRADE B', quantity: 2, unitPrice: 12.5, amount: 25 },
    // A repeated barcode line without a name is a second scan of the same product.
    { name: 'SAMPLE BAG ROLL 28X35', quantity: 1, unitPrice: 8.9, amount: 8.9 },
    { name: 'SAMPLE BAG ROLL 28X35', quantity: 1, unitPrice: 8.9, amount: 8.9 },
  ] });
});

test('restaurant lines with a leading quantity, an amount on the next line, and price-quantity-discount-amount columns', () => {
  const leading = lines('DATE : 01/Jan/2026 12:30:00', '1 Sample Bread 3.80 - T', '3 Sample Flatbread 4.50', '2 Sample Iced Tea', '5.20 - T', 'TOTAL : RM 13.50', 'CASH : RM 20.00');
  assert.deepEqual(items(leading, 13.5).items, [
    { name: 'Sample Bread', quantity: 1, unitPrice: null, amount: 3.8 },
    { name: 'Sample Flatbread', quantity: 3, unitPrice: null, amount: 4.5 },
    { name: 'Sample Iced Tea', quantity: 2, unitPrice: null, amount: 5.2 },
  ]);
  const columns = lines('Item Price Qty Discount Amount', '* Set Meal A - Rice, Fried Chicken', 'DINE IN, T5 Less Spicy', '12.50 2 0.00 25.00', '* Sample Water 500ml', '2.00 1 0.00 2.00', 'TOTAL RM 27.00');
  assert.deepEqual(items(columns, 27).items, [
    { name: 'Set Meal A - Rice, Fried Chicken', quantity: 2, unitPrice: 12.5, amount: 25 },
    { name: 'Sample Water 500ml', quantity: 1, unitPrice: 2, amount: 2 },
  ]);
  // "@ 16.00 x1" is a unit price and quantity, not part of the name; a leading "09" is a pump number.
  assert.deepEqual(items(lines('Purchased Item ( s )', 'SAMPLE CAKE BOX @ 15.00 x2 30.00', 'Subtotal 30.00'), 30).items, [{ name: 'SAMPLE CAKE BOX', quantity: 2, unitPrice: 15, amount: 30 }]);
  assert.deepEqual(items(lines('Invoice', '09 Diesel B10 Std 40.000L @ 5.000 R 200.00 N', 'Total RM 200.00'), 200).items, [{ name: 'Diesel B10 Std 40.000L', quantity: 1, unitPrice: null, amount: 200 }]);
});

test('discounts and promotions become negative lines', () => {
  const promo = lines('Cashier : STAFF B', 'SAMPLE POTATO CHIPS - 1KG', '2000000000011 PKT 1x7.49 7.49', '02 5.99 -1.50', 'BUNDLE PRICE PROMO 4.00', 'SAMPLE COCOA 1KG 18.00', 'Total 19.99');
  assert.deepEqual(items(promo, 19.99).items, [
    { name: 'SAMPLE POTATO CHIPS - 1KG', quantity: 1, unitPrice: 7.49, amount: 7.49 },
    { name: 'Discount', quantity: 1, unitPrice: null, amount: -1.5 },
    { name: 'BUNDLE PRICE PROMO', quantity: 1, unitPrice: null, amount: -4 },
    { name: 'SAMPLE COCOA 1KG', quantity: 1, unitPrice: null, amount: 18 },
  ]);
  const fuel = lines('01JAN2026 10:05 AM', 'FUEL 95 RM25.00', '5.000L@RM5.000/L', 'FUEL95 Subsidy -RM15.00', 'TOTAL RM10.00');
  assert.deepEqual(items(fuel, 10).items, [
    { name: 'FUEL 95', quantity: 1, unitPrice: null, amount: 25 },
    { name: 'FUEL95 Subsidy', quantity: 1, unitPrice: null, amount: -15 },
  ]);
  // A discount amount alone takes the name printed above it.
  assert.deepEqual(items(lines('Purchased Item ( s )', 'Fuel 95 60.00', 'Fuel95', '-10.00', 'Subtotal 50.00'), 50).items.at(-1), { name: 'Fuel95', quantity: 1, unitPrice: null, amount: -10 });
});

test('a two-column receipt read column by column is paired from word positions; text alone still works', () => {
  // Vision's text lists the names first and the prices after them, so text alone cannot pair them.
  const text = lines('KEDAI ABC', 'Date: 08/10/2026 10:15', 'Nasi Lemak', 'Teh Tarik', 'Total', '6.50', '2.50', '9.00');
  const word = (value: string, x0: number, y0: number) => ({ text: value, x0, y0, x1: x0 + 40, y1: y0 + 12, block: 1 });
  const pages = [{ text, words: [word('KEDAI', 0, 0), word('ABC', 50, 0), word('Date:', 0, 30), word('08/10/2026', 50, 30), word('10:15', 100, 30),
    word('Nasi', 0, 60), word('Lemak', 50, 60), word('6.50', 300, 60), word('Teh', 0, 90), word('Tarik', 50, 90), word('2.50', 300, 90),
    word('Total', 0, 120), word('9.00', 300, 120)] }];
  assert.deepEqual(items(text, 9, pages).items, [
    { name: 'Nasi Lemak', quantity: 1, unitPrice: null, amount: 6.5 },
    { name: 'Teh Tarik', quantity: 1, unitPrice: null, amount: 2.5 },
  ]);
  assert.deepEqual(items(text, 9).items, []);
  assert.deepEqual(items(lines('Date: 08/10/2026', 'Nasi Lemak 6.50', 'Teh Tarik 2.50', 'Total 9.00'), 9).items.map((item) => item.name), ['Nasi Lemak', 'Teh Tarik']);
});

test('summary, payment, tax, change, count, address, staff, barcode, and document lines are never items', () => {
  const text = lines(
    'PASARAYA CONTOH SDN BHD', 'LOT 1, JALAN CONTOH', '12345 Bandar Contoh', 'Staff Name : STAFF C', 'Invoice No : INV0000000000001',
    'Sample Coffee 3in1 14.00', 'Item ( s ) : 1 Qty ( s ) 1', 'Sub Total : 14.00', 'Service Charge : 0.00', 'SST 6% 0.00', 'Rounding : 0.00',
    'Total RM 14.00', 'TNG eWallet Tende 14.00', 'Visa ( 400000 ...... 0000 ) 14.00', 'Cash 20.00', 'Change 6.00', 'otal 14.00', 'nge 6.00',
  );
  assert.deepEqual(items(text, 14).items, [{ name: 'Sample Coffee 3in1', quantity: 1, unitPrice: null, amount: 14 }]);
  for (const line of ['Total 45.60', 'SubTotal', 'Grand Total', 'NET TOTAL', 'Cash', 'Change Due', 'Tendered', 'Rounding Adjustment', 'Tax', 'SST', 'Service Charge',
    'TNG eWallet', 'My Debit', 'Mastercard', 'Item ( s ) : 6', 'No. Qtys : 11', 'Jalan Contoh', '54321 Bandar Contoh', 'Cashier : STAFF D', 'Receipt # : 0001',
    'otal', 'nge', 'lotal', 'TCTAL', 'Chang', 'Iten 12']) {
    assert.ok(isExcludedLine(line) || isTruncatedLabel(line), line);
  }
  // Product names that merely contain such a word are kept.
  for (const name of ['SAMPLE RICE SUPER GRADE SST - 10KG', 'SAMPLE GARBAGE BAG 3240-1KG', 'Cashew Nuts', 'Round Bread']) assert.equal(isExcludedLine(name), false, name);
  assert.equal(cleanName('2000000000042 - SAMPLE BROOM HE'), 'SAMPLE BROOM HE');
  assert.equal(cleanName('* Set Meal A- Rice , Chicken CRISPY , Salad & Slaw'), 'Set Meal A- Rice, Chicken CRISPY, Salad & Slaw');
});

test('items that add up within RM 0.05 or with printed rounding pass; a small gap warns; the total is never changed', () => {
  const base = ['Cashier : STAFF B', 'Bread 3.50', 'Milk 6.99'];
  assert.equal(items(lines(...base, 'Total 10.50'), 10.5).incomplete, false); // 10.49 vs 10.50
  assert.equal(items(lines(...base, 'Rounding -0.04', 'Total 10.45'), 10.45).incomplete, false);
  const gap = withReceiptItems(parseReceiptText(lines(...base, 'Eggs', 'Total 12.49')));
  assert.equal(gap.totalAmount, 12.49);
  assert.deepEqual(gap.items.map((item) => item.amount), [3.5, 6.99]);
  assert.ok(gap.warnings.includes(ITEMS_INCOMPLETE));
  // The warning names no reviewed field, so it never marks merchant, date, or total for review.
  assert.doesNotMatch(ITEMS_INCOMPLETE, /merchant|date|total|amount/i);
  // When a printed amount disagrees with its own "qty × unit", the reading that adds up is used.
  const misread = lines('Cashier : STAFF B', 'SAMPLE TEA BAGS - 20S', '2000000000059 BOX 1x8.40 8.30', 'SAMPLE COCOA 1KG', '2000000000066 PKT 2x7.50 15.00', 'Total 23.40');
  assert.deepEqual(items(misread, 23.4), { incomplete: false, items: [
    { name: 'SAMPLE TEA BAGS - 20S', quantity: 1, unitPrice: 8.4, amount: 8.4 },
    { name: 'SAMPLE COCOA 1KG', quantity: 2, unitPrice: 7.5, amount: 15 },
  ] });
});

test('unreliable receipts return no items rather than guesses', () => {
  // No total to check against, an unpaid order, a handwritten bill without priced lines, and lines far from the total.
  assert.deepEqual(items(lines('Nasi Lemak 6.50', 'Teh Tarik 2.50'), null), { items: [], incomplete: false });
  assert.deepEqual(items(lines('ORDER DETAILS', 'UNPAID', '1 SAMPLE NOODLES 6.00', 'Total Amount 6.00'), 6).items, []);
  assert.deepEqual(items(lines('M/S', 'NAMA BT. CONTOH', '1 Jus SAMPLE 50 % 50 %', '4 DISKAUN 620-9 )', 'TOTAL / T 77'), 77).items, []);
  assert.deepEqual(items(lines('Cashier : STAFF B', 'Bread 3.50', 'Total 30.00'), 30), { items: [], incomplete: false });
  // A misread quantity without a printed amount never invents a line.
  assert.deepEqual(items(lines('Cashier : STAFF B', 'SAMPLE MINERAL WATER - 1.5L', '2000000000073 CTN 23x11.50', 'Total 34.50'), 34.5).items, []);
  // Lines that are mostly numbers or contain a price are misreads, not names.
  assert.deepEqual(readItems(['Cashier : STAFF B', 'B Smp (14) 14 42 240.10', 'PKT SAMPX11.90 11.90', 'Total 252.00']), []);
});

test('the parser output is untouched: items only add a field', () => {
  const text = lines('Kedai Buku UMPSA', 'Date: 08/10/2026', 'Pen 3.00', 'Notebook 9.50', 'TOTAL RM 12.50');
  const parsed = parseReceiptText(text);
  const { items: added, ...rest } = withReceiptItems(parsed);
  assert.deepEqual(rest, parsed);
  assert.equal(added.length, 2);
});
