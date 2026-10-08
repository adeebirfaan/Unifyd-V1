import assert from 'node:assert/strict';
import test from 'node:test';

import { moodPeriodBounds, summarizeMoodTrend, suggestionKeys } from '../lib/moodTrends.ts';

const now = new Date(2026, 9, 8, 12, 0);
const entry = (daysBefore, hour, mood_level, stress_level) => ({
  mood_level, stress_level,
  recorded_at: new Date(2026, 9, 8 - daysBefore, hour, 0).toISOString(),
});

test('empty periods contain missing days, no fabricated score or comparison', () => {
  const summary = summarizeMoodTrend([], 7, now);
  assert.equal(summary.count, 0);
  assert.equal(summary.mood, null);
  assert.equal(summary.stress, null);
  assert.equal(summary.comparison, null);
  assert.equal(summary.days.length, 7);
  assert.ok(summary.days.every((day) => day.count === 0 && day.mood === null && day.stress === null));
});

test('one check-in shows its score but no comparison', () => {
  const summary = summarizeMoodTrend([entry(0, 9, 4, 2)], 7, now);
  assert.equal(summary.count, 1);
  assert.equal(summary.mood, 4);
  assert.equal(summary.stress, 2);
  assert.equal(summary.comparison, null);
  assert.equal(summary.days.at(-1).count, 1);
  assert.equal(summary.days.at(-2).mood, null);
});

test('multiple local-day entries are averaged while missing days stay empty', () => {
  const summary = summarizeMoodTrend([entry(0, 0, 2, 5), entry(0, 11, 4, 3), entry(2, 12, 5, 1)], 7, now);
  assert.equal(summary.count, 3);
  assert.equal(summary.mood, 11 / 3);
  assert.equal(summary.stress, 3);
  assert.deepEqual(summary.days.slice(-3).map((day) => day.mood), [5, null, 3]);
  assert.equal(summary.days.at(-1).stress, 4);
});

test('7-day and 30-day windows use local boundaries and exclude older entries', () => {
  const rows = [entry(0, 9, 5, 1), entry(7, 9, 1, 5), entry(29, 9, 3, 3), entry(30, 9, 2, 4), entry(60, 9, 1, 1)];
  assert.equal(summarizeMoodTrend(rows, 7, now).count, 1);
  assert.equal(summarizeMoodTrend(rows, 30, now).count, 3);
  const bounds = moodPeriodBounds(7, now);
  assert.equal(bounds.currentStart.getDate(), 2);
  assert.equal(bounds.endExclusive.getDate(), 9);
});

test('comparison requires two check-ins in each equal-length period', () => {
  const current = [entry(0, 9, 5, 1), entry(1, 9, 4, 2)];
  assert.equal(summarizeMoodTrend([...current, entry(8, 9, 2, 4)], 7, now).comparison, null);
  const summary = summarizeMoodTrend([...current, entry(8, 9, 2, 4), entry(9, 9, 3, 3)], 7, now);
  assert.deepEqual(summary.comparison, { mood: 'higher', stress: 'lower' });
  const similar = summarizeMoodTrend([...current, entry(8, 9, 5, 1), entry(9, 9, 4, 2)], 7, now);
  assert.deepEqual(similar.comparison, { mood: 'similar', stress: 'similar' });
});

test('suggestions use only the latest levels and return at most two keys', () => {
  assert.deepEqual(suggestionKeys(null), ['mind.ideaRoutine', 'mind.ideaPause']);
  assert.deepEqual(suggestionKeys({ mood_level: 1, stress_level: 5 }), ['mind.ideaScreenBreak', 'mind.ideaReachOut']);
  assert.deepEqual(suggestionKeys({ mood_level: 4, stress_level: 4 }), ['mind.ideaScreenBreak', 'mind.ideaSmallTask']);
  assert.deepEqual(suggestionKeys({ mood_level: 2, stress_level: 2 }), ['mind.ideaWrite', 'mind.ideaCalm']);
  assert.deepEqual(suggestionKeys({ mood_level: 4, stress_level: 2 }), ['mind.ideaRoutine', 'mind.ideaGoodThing']);
});
