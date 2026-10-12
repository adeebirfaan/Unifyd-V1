import assert from 'node:assert/strict';
import test from 'node:test';

import { attentionItems, budgetStatus, donutSegments, topCategories, usageFraction } from '../lib/walletOverview.ts';

const figures = (budgetCents, spentCents) => ({
  budgetCents, spentCents,
  balanceCents: budgetCents === null ? null : budgetCents - spentCents,
  percentageUsed: budgetCents === null ? null : spentCents / budgetCents * 100,
});

test('budget status follows the existing summary: none, healthy, near (≥ 80%), or over', () => {
  assert.equal(budgetStatus(figures(null, 5000)), 'noBudget');
  assert.equal(budgetStatus(figures(50000, 5000)), 'healthy');
  assert.equal(budgetStatus(figures(50000, 40000)), 'near');
  assert.equal(budgetStatus(figures(50000, 50000)), 'near');
  assert.equal(budgetStatus(figures(7500, 8000)), 'over');
});

test('the ring fraction is clamped for drawing while the real percentage is untouched', () => {
  assert.equal(usageFraction(figures(50000, 5000)), 0.1);
  assert.equal(usageFraction(figures(7500, 8000)), 1);
  assert.equal(usageFraction(figures(null, 100)), null);
});

const categories = [
  { category: 'food', cents: 3000, percentage: 33.7 },
  { category: 'transport', cents: 2000, percentage: 22.5 },
  { category: 'personal', cents: 3000, percentage: 33.7 },
  { category: 'other', cents: 900, percentage: 10.1 },
];

test('top categories are the three largest, ties in the fixed order, with the rest summed', () => {
  const { top, restCount, restCents } = topCategories(categories);
  assert.deepEqual(top.map((entry) => entry.category), ['food', 'personal', 'transport']);
  assert.equal(restCount, 1);
  assert.equal(restCents, 900);
  assert.deepEqual(topCategories([]), { top: [], restCount: 0, restCents: 0 });
  assert.deepEqual(topCategories([{ category: 'food', cents: 0, percentage: 0 }]).top, []);
});

test('donut segments cover the whole circle in order, and nothing is drawn with no spending', () => {
  const segments = donutSegments(categories);
  assert.deepEqual(segments.map((segment) => segment.category), ['food', 'personal', 'transport', 'other']);
  assert.equal(segments[0].start, 0);
  const last = segments.at(-1);
  assert.ok(Math.abs(last.start + last.length - 1) < 1e-12);
  assert.deepEqual(donutSegments([]), []);
});

test('attention lists at most two real items, highest priority first, and nothing when calm', () => {
  const renewals = [{ name: 'Spotify', days: 2 }, { name: 'Canva', days: 5 }];
  assert.deepEqual(attentionItems({ summary: figures(50000, 5000), renewals: [], owedCents: 0 }), []);
  assert.deepEqual(attentionItems({ summary: figures(null, 5000), renewals: null, owedCents: null }), []);
  assert.deepEqual(attentionItems({ summary: figures(7500, 8000), renewals, owedCents: 4000 }), [
    { kind: 'overBudget', overCents: 500 },
    { kind: 'renewals', count: 2, nextName: 'Spotify', nextDays: 2 },
  ]);
  assert.deepEqual(attentionItems({ summary: figures(50000, 45000), renewals: [], owedCents: 4000 }), [
    { kind: 'nearBudget', percent: 90 },
    { kind: 'owed', cents: 4000 },
  ]);
  assert.deepEqual(attentionItems({ summary: figures(50000, 5000), renewals, owedCents: 4000 }).map((item) => item.kind), ['renewals', 'owed']);
});
