import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ITEMS_PREVIEW, READING_MIN_MS, READING_SLOW_MS, draftAmount, draftItems, itemsMismatch, itemsTotalCents, parseItemInput,
  receiptItems, remainingMinimumMs, reviewFlags, shownUnitPrice, visibleItems,
} from '../lib/scanFlow.ts';

test('Reading stays at least 1.2 s, and a slow result adds no extra delay', () => {
  assert.equal(READING_MIN_MS, 1200);
  assert.equal(READING_SLOW_MS, 20000);
  assert.equal(remainingMinimumMs(1000, 1000), 1200);
  assert.equal(remainingMinimumMs(1000, 1300), 900);
  assert.equal(remainingMinimumMs(1000, 2200), 0);
  assert.equal(remainingMinimumMs(1000, 9000), 0);
});

test('the server warnings mark exactly the matching Details fields', () => {
  assert.deepEqual(reviewFlags([]), { fields: { merchant: false, date: false, total: false }, noText: false, other: false, itemsIncomplete: false });
  assert.deepEqual(reviewFlags(['Merchant name needs review.', 'Total amount needs review.']).fields, { merchant: true, date: false, total: true });
  assert.deepEqual(reviewFlags(['Purchase date needs review.']).fields, { merchant: false, date: true, total: false });
  const empty = reviewFlags(['No readable text was detected.', 'Merchant name needs review.', 'Purchase date needs review.', 'Total amount needs review.']);
  assert.equal(empty.noText, true);
  assert.equal(empty.other, false);
  // Unknown wording is never guessed onto a field.
  assert.deepEqual(reviewFlags(['Something else.']), { fields: { merchant: false, date: false, total: false }, noText: false, other: true, itemsIncomplete: false });
  // The server's items warning marks only the Items card, never a Details field or the general notice.
  assert.deepEqual(reviewFlags(['Items may be incomplete.']), { fields: { merchant: false, date: false, total: false }, noText: false, other: false, itemsIncomplete: true });
});

test('a detected total becomes a two-decimal draft amount', () => {
  assert.equal(draftAmount(12.5), '12.50');
  assert.equal(draftAmount(329.15), '329.15');
  assert.equal(draftAmount(null), '');
  assert.equal(draftAmount(0), '');
});

test('the optional items field is accepted only when every line is valid', () => {
  assert.deepEqual(receiptItems(undefined), []);
  assert.deepEqual(receiptItems('items'), []);
  const items = [{ name: ' Sample Crisps ', quantity: 1, unitPrice: 4.5, amount: 4.5 }, { name: 'Sample Candy 15g', quantity: 5, unitPrice: 1.8, amount: 9 }, { name: 'Bundle price promo', quantity: 1, unitPrice: null, amount: -4 }];
  assert.deepEqual(receiptItems(items), [{ name: 'Sample Crisps', quantity: 1, unitPrice: 4.5, amount: 4.5 }, items[1], items[2]]);
  // A missing unit price is null; one that disagrees with the amount is not shown; a negative one is invalid.
  assert.deepEqual(receiptItems([{ name: 'Milk', quantity: 2, amount: 7.8 }]), [{ name: 'Milk', quantity: 2, unitPrice: null, amount: 7.8 }]);
  assert.deepEqual(receiptItems([{ name: 'Milk', quantity: 2, unitPrice: 3, amount: 7.8 }])[0].unitPrice, null);
  assert.deepEqual(receiptItems([{ name: 'Milk', quantity: 2, unitPrice: -3, amount: 7.8 }]), []);
  // One malformed line drops the list rather than showing half of it.
  assert.deepEqual(receiptItems([...items, { name: '', quantity: 1, amount: 2 }]), []);
  assert.deepEqual(receiptItems([{ name: 'A', quantity: 0, amount: 2 }]), []);
  assert.deepEqual(receiptItems([{ name: 'A', quantity: 1.5, amount: 2 }]), []);
  assert.deepEqual(receiptItems([{ name: 'A', quantity: 1, amount: 0 }]), []);
});

test('long item lists start collapsed to the first four', () => {
  const items = draftItems(Array.from({ length: 9 }, (_, index) => ({ name: `Item ${index}`, quantity: 1, amount: 1 })));
  assert.equal(ITEMS_PREVIEW, 4);
  assert.deepEqual(visibleItems(items, false).map((item) => item.name), ['Item 0', 'Item 1', 'Item 2', 'Item 3']);
  assert.equal(visibleItems(items, true).length, 9);
  assert.equal(visibleItems(items.slice(0, 4), false).length, 4);
  assert.equal(new Set(items.map((item) => item.id)).size, 9);
});

test('items add up in cents with discounts negative, and a mismatch is reported only against a readable total', () => {
  const items = [{ name: 'A', quantity: 1, amount: 5.3 }, { name: 'B', quantity: 1, amount: 0.1 }, { name: 'Promo', quantity: 1, amount: -0.4 }];
  assert.equal(itemsTotalCents(items), 500);
  assert.equal(itemsMismatch(items, 5), false);
  assert.equal(itemsMismatch(items, 5.01), true);
  assert.equal(itemsMismatch(items, null), false);
  assert.equal(itemsMismatch([], 5), false);
});

test('the item sheet validates name, whole quantity, and a positive two-decimal price; discounts become negative', () => {
  assert.deepEqual(parseItemInput({ name: ' Milk ', quantity: '2', price: '7.80' }, false), { item: { name: 'Milk', quantity: 2, unitPrice: null, amount: 7.8 }, errors: {} });
  assert.deepEqual(parseItemInput({ name: 'Promo', quantity: 'ignored', price: '5' }, true).item, { name: 'Promo', quantity: 1, unitPrice: null, amount: -5 });
  assert.deepEqual(parseItemInput({ name: '', quantity: '0', price: '1.234' }, false), { item: null, errors: { name: true, quantity: true, price: true } });
  assert.deepEqual(parseItemInput({ name: 'X', quantity: '1', price: '-2' }, false).errors, { price: true });
});

test('an edited item keeps its printed unit price only while quantity × unit still equals the amount', () => {
  assert.equal(shownUnitPrice(5, 2, 10), 2);
  assert.equal(shownUnitPrice(4, 2, 10), null);
  assert.equal(shownUnitPrice(5, 2, 9.99), null);
  assert.equal(shownUnitPrice(1, null, 5), null);
  assert.equal(shownUnitPrice(1, 5, -5), null);
});
