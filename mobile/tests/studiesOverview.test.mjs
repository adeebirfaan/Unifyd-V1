import assert from 'node:assert/strict';
import test from 'node:test';

import { academicFocus, completedTasks, minutesUntilClass, priorityGroup, priorityTasks, taskUrgency } from '../lib/studiesOverview.ts';

// Tests run with TZ=Asia/Kuala_Lumpur; "now" is Tue 13 Oct 2026, 10:00 local.
const now = new Date(2026, 9, 13, 10, 0);
const at = (day, hour = 9, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();
let seq = 0;
const task = (id, fields) => ({
  id, title: id, subject: 'S', description: null, deadline: at(20), priority: 'medium', status: 'pending', completed_at: null,
  created_at: new Date(2026, 9, 1, 0, seq++).toISOString(), ...fields,
});

test('priority order: overdue, due today, High, Medium, Low by nearest deadline, then undated; completed left out', () => {
  const tasks = [
    task('low-soon', { priority: 'low', deadline: at(14) }),
    task('done', { status: 'completed', completed_at: at(12), deadline: at(10) }),
    task('undated', { priority: 'high', deadline: '' }),
    task('high-later', { priority: 'high', deadline: at(25) }),
    task('today-low', { priority: 'low', deadline: at(13, 18) }),
    task('overdue-new', { priority: 'low', deadline: at(13, 8) }),
    task('medium', { priority: 'medium', deadline: at(15) }),
    task('high-sooner', { priority: 'high', deadline: at(21), status: 'ongoing' }),
    task('overdue-old', { priority: 'high', deadline: at(11) }),
    task('today-high', { priority: 'high', deadline: at(13, 12) }),
  ];
  assert.deepEqual(priorityTasks(tasks, now).map((item) => item.id),
    ['overdue-old', 'overdue-new', 'today-high', 'today-low', 'high-sooner', 'high-later', 'medium', 'low-soon', 'undated']);
});

test('ties use priority, then creation time, then ID, so the order is stable', () => {
  const same = at(22);
  const tasks = [
    task('b', { deadline: same, created_at: at(2) }),
    task('a', { deadline: same, created_at: at(2) }),
    task('older', { deadline: same, created_at: at(1) }),
  ];
  assert.deepEqual(priorityTasks(tasks, now).map((item) => item.id), ['older', 'a', 'b']);
  assert.deepEqual(priorityTasks([...tasks].reverse(), now).map((item) => item.id), ['older', 'a', 'b']);
  // Equal overdue deadlines: the higher priority first.
  const overdue = [task('low', { priority: 'low', deadline: at(12) }), task('high', { priority: 'high', deadline: at(12) })];
  assert.deepEqual(priorityTasks(overdue, now).map((item) => item.id), ['high', 'low']);
});

test('groups and urgency use local days; completed tasks never show urgency', () => {
  assert.equal(priorityGroup({ deadline: at(13, 23, 59), priority: 'low' }, now), 'today');
  assert.equal(priorityGroup({ deadline: at(14, 0, 0), priority: 'low' }, now), 'low');
  assert.equal(priorityGroup({ deadline: at(13, 9, 59), priority: 'low' }, now), 'overdue');
  assert.equal(priorityGroup({ deadline: 'not a date', priority: 'high' }, now), 'undated');
  assert.equal(taskUrgency({ deadline: at(13, 9), priority: 'low', status: 'pending' }, now), 'overdue');
  assert.equal(taskUrgency({ deadline: at(13, 9), priority: 'low', status: 'completed' }, now), null);
  assert.equal(taskUrgency({ deadline: at(16), priority: 'high', status: 'pending' }, now), null);
});

test('academic focus counts only real tasks', () => {
  const tasks = [
    task('o', { deadline: at(12) }), task('t', { deadline: at(13, 15) }), task('u1', { deadline: at(14) }), task('u2', { deadline: at(30) }),
    task('n', { deadline: '' }), task('c1', { status: 'completed', completed_at: at(12) }), task('c2', { status: 'completed', completed_at: at(11), deadline: at(5) }),
  ];
  assert.deepEqual(academicFocus(tasks, now), { overdue: 1, dueToday: 1, upcoming: 2, completed: 2, total: 7 });
  assert.deepEqual(academicFocus([], now), { overdue: 0, dueToday: 0, upcoming: 0, completed: 0, total: 0 });
  assert.deepEqual(completedTasks(tasks).map((item) => item.id), ['c1', 'c2']);
});

test('minutes until class only for a later class today', () => {
  assert.equal(minutesUntilClass(10 * 60 + 45, 0, now), 45);
  assert.equal(minutesUntilClass(10 * 60, 0, now), null);
  assert.equal(minutesUntilClass(8 * 60, 1, now), null);
});
