import assert from 'node:assert/strict';
import test from 'node:test';

import { translate } from '../constants/i18n.ts';
import { groupExpensesByDate, relativeDay } from '../lib/expenseGroups.ts';

const row = (id, expense_date, amount) => ({ id, expense_date, amount });

test('expenses on the same calendar date share one group, newest dates first, rows in their original order', () => {
  const groups = groupExpensesByDate([
    row('a', '2026-10-13', '10.00'), row('b', '2026-10-13', 20), row('c', '2026-10-08', '15.00'),
    row('d', '2026-10-07', '4.00'), row('e', '2026-10-07', '0.10'),
  ]);
  assert.deepEqual(groups.map((group) => group.date), ['2026-10-13', '2026-10-08', '2026-10-07']);
  assert.deepEqual(groups.map((group) => group.expenses.map((expense) => expense.id)), [['a', 'b'], ['c'], ['d', 'e']]);
  assert.ok(groups.every((group) => group.expenses.length > 0));
});

test('group totals are exact integer-cent sums of that date only', () => {
  const groups = groupExpensesByDate([row('a', '2026-10-13', '0.10'), row('b', '2026-10-13', '0.20'), row('c', '2026-10-12', '146.00')]);
  assert.deepEqual(groups.map((group) => group.totalCents), [30, 14600]);
});

test('later pages merge into an existing date group instead of repeating the date', () => {
  const firstPage = [row('a', '2026-10-13', 5), row('b', '2026-10-12', 6)];
  const secondPage = [row('c', '2026-10-12', 7), row('d', '2026-10-11', 8)];
  const groups = groupExpensesByDate([...firstPage, ...secondPage]);
  assert.deepEqual(groups.map((group) => group.date), ['2026-10-13', '2026-10-12', '2026-10-11']);
  assert.deepEqual(groups[1].expenses.map((expense) => expense.id), ['b', 'c']);
  assert.equal(groups[1].totalCents, 1300);
  assert.deepEqual(groupExpensesByDate([]), []);
});

test('only the five previewed rows are grouped, so the preview never exceeds five rows', () => {
  const all = Array.from({ length: 9 }, (_, index) => row(`r${index}`, index < 3 ? '2026-10-13' : '2026-10-12', 1));
  const groups = groupExpensesByDate(all.slice(0, 5));
  assert.equal(groups.reduce((sum, group) => sum + group.expenses.length, 0), 5);
  assert.deepEqual(groups.map((group) => group.expenses.length), [3, 2]);
});

test('Today and Yesterday use the local calendar date, including across a month boundary', () => {
  assert.equal(relativeDay('2026-10-13', '2026-10-13'), 'today');
  assert.equal(relativeDay('2026-10-12', '2026-10-13'), 'yesterday');
  assert.equal(relativeDay('2026-09-30', '2026-10-01'), 'yesterday');
  assert.equal(relativeDay('2026-10-11', '2026-10-13'), null);
});

test('date-group labels exist in English and Malay', () => {
  assert.equal(translate('en', 'wallet.today'), 'Today');
  assert.equal(translate('ms', 'wallet.today'), 'Hari ini');
  assert.equal(translate('ms', 'wallet.yesterday'), 'Semalam');
  assert.equal(translate('en', 'wallet.dayGroupA11y', { date: '13 October 2026', amount: 'RM 146.00' }), 'Expenses for 13 October 2026, total RM 146.00');
  assert.equal(translate('ms', 'wallet.dayGroupA11y', { date: '13 Oktober 2026', amount: 'RM 146.00' }), 'Perbelanjaan pada 13 Oktober 2026, jumlah RM 146.00');
});
