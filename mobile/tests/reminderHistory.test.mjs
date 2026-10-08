import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReminderHistory } from '../lib/reminderHistory.ts';

const now = Date.parse('2026-10-09T12:00:00+08:00');
const at = (hours) => new Date(now + hours * 3_600_000).toISOString();
const task = (id, deadlineHours, offset, status = 'pending', completedHours = null) => ({
  id, title: `Task ${id}`, subject: 'BCS2233', deadline: at(deadlineHours), status,
  completed_at: completedHours === null ? null : at(completedHours), reminder_offset_minutes: offset,
});

test('upcoming lists active future reminders soonest first, using deadline minus offset', () => {
  const { upcoming } = buildReminderHistory([
    task('late', 48, 1440),        // fires in 24 h
    task('soon', 3, 60),           // fires in 2 h
    task('none', 5, null),         // no reminder chosen
    task('done', 30, 0, 'completed', -1), // completed tasks are not scheduled
  ], now);
  assert.deepEqual(upcoming.map((item) => [item.taskId, item.fireAt]), [['soon', at(2)], ['late', at(24)]]);
  assert.equal(upcoming[0].offset, 60);
});

test('past keeps the last 30 days and drops reminders cancelled by completion', () => {
  const { past } = buildReminderHistory([
    task('fired', 1, 1440),                     // fired 23 h ago, still pending
    task('ongoing', -2, 0, 'ongoing'),          // fired 2 h ago
    task('completedAfter', -10, 60, 'completed', -5),  // fired 11 h ago, then completed
    task('completedBefore', -10, 60, 'completed', -20), // completed before its reminder
    task('old', -24 * 31, 0),                   // outside the 30-day window
  ], now);
  assert.deepEqual(past.map((item) => item.taskId), ['ongoing', 'completedAfter', 'fired']);
});

test('invalid deadlines and unknown offsets are ignored', () => {
  const result = buildReminderHistory([
    { ...task('bad', 5, 60), deadline: 'not-a-date' },
    task('odd', 5, 30),
  ], now);
  assert.deepEqual(result, { upcoming: [], past: [] });
});
