import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_QUICK_ACTIONS, parseQuickActions, toggleQuickAction } from '../lib/quickActions.ts';

test('a valid stored choice is kept in catalogue order', () => {
  assert.deepEqual(parseQuickActions(JSON.stringify(['logMood', 'setBudget'])), ['setBudget', 'logMood']);
});

test('missing, malformed, unknown, duplicate, empty, or oversized choices fall back to the defaults', () => {
  for (const raw of [null, '', 'not json', '{}', '[]', '["addTask","addTask"]', '["addTask","teleport"]',
    JSON.stringify(['addExpense', 'scanReceipt', 'setBudget', 'addTask', 'logMood'])]) {
    assert.deepEqual(parseQuickActions(raw), [...DEFAULT_QUICK_ACTIONS], String(raw));
  }
});

test('toggling keeps between one and four shortcuts', () => {
  const four = [...DEFAULT_QUICK_ACTIONS];
  assert.deepEqual(toggleQuickAction(four, 'reminders'), four, 'a fifth shortcut is refused');
  assert.deepEqual(toggleQuickAction(four, 'scanReceipt'), ['addExpense', 'addTask', 'logMood']);
  assert.deepEqual(toggleQuickAction(['addTask', 'logMood'], 'mySemester'), ['addTask', 'mySemester', 'logMood']);
  assert.deepEqual(toggleQuickAction(['addTask'], 'addTask'), ['addTask'], 'the last shortcut cannot be removed');
});
