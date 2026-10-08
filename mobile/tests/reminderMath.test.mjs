import assert from 'node:assert/strict';
import test from 'node:test';

import { isReminderOffset, reminderFireTime, reminderLabelKey } from '../lib/reminderMath.ts';

test('only the four saved reminder choices are valid', () => {
  for (const choice of [null, 0, 60, 1440]) assert.equal(isReminderOffset(choice), true);
  for (const choice of [undefined, -1, 1, 180, '60']) assert.equal(isReminderOffset(choice), false);
});

test('one-time fire times subtract the selected minutes from the deadline instant', () => {
  const deadline = '2026-10-09T10:00:00+08:00';
  const now = Date.parse('2026-10-08T00:00:00+08:00');
  assert.equal(reminderFireTime(deadline, 0, now)?.toISOString(), '2026-10-09T02:00:00.000Z');
  assert.equal(reminderFireTime(deadline, 60, now)?.toISOString(), '2026-10-09T01:00:00.000Z');
  assert.equal(reminderFireTime(deadline, 1440, now)?.toISOString(), '2026-10-08T02:00:00.000Z');
  assert.equal(reminderFireTime(deadline, null, now), null);
});

test('past, immediate, and invalid fire times are not scheduled', () => {
  const deadline = '2026-10-09T10:00:00+08:00';
  assert.equal(reminderFireTime(deadline, 60, Date.parse('2026-10-09T09:00:00+08:00')), null);
  assert.equal(reminderFireTime('not-a-date', 0), null);
});

test('saved offsets map to translated option keys', () => {
  assert.deepEqual([null, 0, 60, 1440].map(reminderLabelKey), [
    'task.reminderNone', 'task.reminderAtDeadline', 'task.reminderHour', 'task.reminderDay',
  ]);
});
