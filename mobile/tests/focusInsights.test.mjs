import assert from 'node:assert/strict';
import test from 'node:test';

import {
  focusDuration, goalProgress, insightsFetchSince, localDayKey, mergeFocusRecords, normalizeGoal, recordFromBlock, recordFromRow, summarizeFocus, weekStart, wholePercents,
} from '../lib/focusInsights.ts';

// Tests run with TZ=Asia/Kuala_Lumpur. "now" is Thursday 15 Oct 2026, 21:00 local.
const now = new Date(2026, 9, 15, 21, 0);
const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();
let seq = 0;
const rec = (fields) => ({ id: `r${++seq}`, subjectLabel: null, taskTitle: null, focusSeconds: 1500, plannedSeconds: 1500, status: 'completed', startedAt: at(15, 9), endedAt: at(15, 9, 30), source: 'synced', ...fields });

test('local weeks run Monday to Sunday and days use the device’s calendar, not UTC', () => {
  assert.equal(localDayKey(weekStart(now)), '2026-10-12');
  assert.equal(localDayKey(weekStart(new Date(2026, 9, 18, 23, 59))), '2026-10-12');
  assert.equal(localDayKey(weekStart(new Date(2026, 9, 19, 0, 0))), '2026-10-19');
  // 00:30 local on 16 Oct is still 15 Oct in UTC; the local day is what counts.
  assert.equal(localDayKey(at(16, 0, 30)), '2026-10-16');
  assert.equal(new Date(at(16, 0, 30)).getUTCDate(), 15);
  assert.ok(insightsFetchSince(now) < new Date(2026, 8, 16));
});

test('only recorded focus time counts: partial rounds by their own time, never planned time', () => {
  const summary = summarizeFocus([
    rec({ endedAt: at(15, 10) }),
    rec({ status: 'partial', focusSeconds: 600, plannedSeconds: 3000, endedAt: at(15, 14) }),
    rec({ endedAt: at(13, 20), focusSeconds: 3000, plannedSeconds: 3000 }),
    rec({ endedAt: at(11, 20) }), // last Sunday: not this week
  ], now);
  assert.equal(summary.todaySeconds, 2100);
  assert.equal(summary.weekSeconds, 5100);
  assert.equal(summary.weekCompleted, 2);
  assert.equal(summary.weekPartial, 1);
  assert.deepEqual(summary.week.map((day) => [day.key, day.seconds, day.isToday, day.isFuture]), [
    ['2026-10-12', 0, false, false], ['2026-10-13', 3000, false, false], ['2026-10-14', 0, false, false], ['2026-10-15', 2100, true, false],
    ['2026-10-16', 0, false, true], ['2026-10-17', 0, false, true], ['2026-10-18', 0, false, true],
  ]);
});

test('a round crossing midnight counts once, on the local day it ended, and is never split', () => {
  const summary = summarizeFocus([rec({ startedAt: at(14, 23, 40), endedAt: at(15, 0, 10), focusSeconds: 1500 })], now);
  assert.equal(summary.week[2].seconds, 0);
  assert.equal(summary.week[3].seconds, 1500);
  assert.equal(summary.todaySeconds, 1500);
  // Sunday 23:50 → Monday 00:15 belongs to the new week.
  const next = summarizeFocus([rec({ startedAt: at(18, 23, 50), endedAt: at(19, 0, 15) })], new Date(2026, 9, 19, 9));
  assert.equal(next.weekSeconds, 1500);
  assert.equal(summarizeFocus([rec({ startedAt: at(18, 23, 50), endedAt: at(19, 0, 15) })], new Date(2026, 9, 18, 23, 59)).weekSeconds, 0);
});

test('synced and device rounds are merged by ID, so a round being synced is never counted twice', () => {
  const block = { id: 'same', status: 'completed', preset: 'classic', plannedFocusSeconds: 1500, focusSeconds: 1500, roundNumber: 1, startedAt: at(15, 9), endedAt: at(15, 9, 30),
    courseId: null, subjectLabel: ' BCS3153 — Software Evolution ', taskId: null, taskTitle: '' };
  const device = [recordFromBlock(block), recordFromBlock({ ...block, id: 'only-device', endedAt: at(15, 11) })];
  assert.deepEqual(device[0], { id: 'same', subjectLabel: 'BCS3153 — Software Evolution', taskTitle: null, focusSeconds: 1500, plannedSeconds: 1500, status: 'completed',
    startedAt: at(15, 9), endedAt: at(15, 9, 30), source: 'device' });
  const synced = [recordFromRow({ id: 'same', subject_label: 'BCS3153 — Software Evolution', task_title: null, focus_seconds: 1500, planned_focus_seconds: 1500, status: 'completed', started_at: at(15, 9), ended_at: at(15, 9, 30) })];
  const merged = mergeFocusRecords(synced, device);
  assert.deepEqual(merged.map((item) => [item.id, item.source]), [['only-device', 'device'], ['same', 'synced']]);
  const summary = summarizeFocus(merged, now);
  assert.equal(summary.todaySeconds, 3000);
  assert.equal(summary.deviceCount, 1);
});

test('subjects use saved labels (deleted subjects keep their name), include General study, and percentages add up to 100', () => {
  const summary = summarizeFocus([
    rec({ subjectLabel: 'BCS3153 — Software Evolution', focusSeconds: 3000, plannedSeconds: 3000 }),
    rec({ subjectLabel: 'BCS3153 — Software Evolution', status: 'partial', focusSeconds: 600, plannedSeconds: 1500 }),
    rec({ subjectLabel: 'Deleted subject', focusSeconds: 1200, plannedSeconds: 1500, status: 'partial' }),
    rec({ subjectLabel: null, focusSeconds: 1200, plannedSeconds: 1500, status: 'partial' }),
    rec({ subjectLabel: 'Old', endedAt: new Date(2026, 8, 15, 9).toISOString() }), // older than 30 days
  ], now);
  assert.deepEqual(summary.subjects.map((item) => [item.label, item.seconds, item.percent]), [
    ['BCS3153 — Software Evolution', 3600, 60], ['Deleted subject', 1200, 20], [null, 1200, 20],
  ]);
  assert.equal(summary.subjectSeconds, 6000);
  assert.deepEqual(wholePercents([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(wholePercents([0, 0]), [0, 0]);
  assert.deepEqual(summarizeFocus([], now).subjects, []);
});

test('no sessions: every figure is zero and nothing claims a percentage', () => {
  const summary = summarizeFocus([], now);
  assert.equal(summary.todaySeconds + summary.weekSeconds + summary.weekCompleted + summary.weekPartial + summary.subjectSeconds, 0);
  assert.equal(summary.week.length, 7);
});

test('durations round down to whole minutes, never overstating time', () => {
  assert.deepEqual([0, 59, 60, 1500, 3599, 3600, 5430].map(focusDuration),
    [{ hours: 0, minutes: 0 }, { hours: 0, minutes: 0 }, { hours: 0, minutes: 1 }, { hours: 0, minutes: 25 }, { hours: 0, minutes: 59 }, { hours: 1, minutes: 0 }, { hours: 1, minutes: 30 }]);
});

test('goals stay within limits and show calm, capped progress', () => {
  assert.deepEqual(normalizeGoal({ period: 'day', minutes: 70 }), { period: 'day', minutes: 75 });
  assert.deepEqual(normalizeGoal({ period: 'week', minutes: 99999 }), { period: 'week', minutes: 3000 });
  assert.deepEqual(normalizeGoal({ period: 'day', minutes: 1 }), { period: 'day', minutes: 15 });
  for (const bad of [null, {}, { period: 'month', minutes: 60 }, { period: 'day', minutes: 'x' }]) assert.equal(normalizeGoal(bad), null);
  assert.deepEqual(goalProgress({ period: 'day', minutes: 60 }, { todaySeconds: 1800, weekSeconds: 9000 }), { doneMinutes: 30, goalMinutes: 60, ratio: 0.5, reached: false });
  assert.deepEqual(goalProgress({ period: 'week', minutes: 120 }, { todaySeconds: 0, weekSeconds: 9000 }), { doneMinutes: 150, goalMinutes: 120, ratio: 1, reached: true });
});

test('suggestions: a task due later today or tomorrow comes first; overdue and completed tasks are never nagged about', async () => {
  const { focusSuggestions } = await import('../lib/focusInsights.ts');
  const task = (id, deadline, fields = {}) => ({ id, title: id, subject: 'BCS3153 — Software Evolution', deadline, status: 'pending', ...fields });
  const base = { now, records: [], subjects: [], goal: null, limit: 3 };
  assert.deepEqual(focusSuggestions({ ...base, tasks: [task('late', at(14, 9)), task('done', at(15, 23), { status: 'completed' }), task('soon', at(16, 10)), task('tonight', at(15, 23, 30))] }).slice(0, 1),
    [{ kind: 'dueSoon', taskId: 'tonight', title: 'tonight', subject: 'BCS3153 — Software Evolution', when: 'today' }]);
  assert.deepEqual(focusSuggestions({ ...base, tasks: [task('soon', at(16, 10)), task('later', at(18, 10))] })[0], { kind: 'dueSoon', taskId: 'soon', title: 'soon', subject: 'BCS3153 — Software Evolution', when: 'tomorrow' });
  assert.equal(focusSuggestions({ ...base, tasks: [task('later', at(18, 10))] })[0].kind, 'starter');
});

test('suggestions use only recorded facts: goal progress from half-way, an hour milestone, and a subject gap after some study this week', async () => {
  const { focusSuggestions } = await import('../lib/focusInsights.ts');
  const records = [rec({ subjectLabel: 'BCS3153 — Software Evolution', focusSeconds: 3000, plannedSeconds: 3000, endedAt: at(15, 10) }), rec({ endedAt: at(15, 12) })];
  const subjects = ['BCS3153 — Software Evolution', 'BCS2243 — Database Systems'];
  assert.deepEqual(focusSuggestions({ now, records, tasks: [], subjects, goal: { period: 'day', minutes: 120 }, limit: 5 }), [
    { kind: 'goalNear', period: 'day', leftSeconds: 2700 },
    { kind: 'todayMilestone', seconds: 4500 },
    { kind: 'subjectGap', subject: 'BCS2243 — Database Systems' },
  ]);
  assert.deepEqual(focusSuggestions({ now, records, tasks: [], subjects, goal: { period: 'day', minutes: 60 }, limit: 1 }), [{ kind: 'goalReached', period: 'day' }]);
  // Under half-way: no goal message. No study this week yet: no subject gap (no guilt at zero).
  assert.deepEqual(focusSuggestions({ now, records: [rec({ endedAt: at(15, 10), focusSeconds: 600, plannedSeconds: 1500, status: 'partial' })], tasks: [], subjects, goal: { period: 'day', minutes: 120 }, limit: 5 }),
    [{ kind: 'subjectGap', subject: 'BCS3153 — Software Evolution' }]);
  assert.deepEqual(focusSuggestions({ now, records: [rec({ endedAt: at(5, 10) })], tasks: [], subjects, goal: null, limit: 5 }), []);
});

test('suggestions never guess when focus history is unavailable, and respect the limit', async () => {
  const { focusSuggestions } = await import('../lib/focusInsights.ts');
  assert.deepEqual(focusSuggestions({ now, records: null, tasks: null, subjects: null, goal: { period: 'day', minutes: 60 }, limit: 3 }), []);
  assert.deepEqual(focusSuggestions({ now, records: [], tasks: null, subjects: null, goal: null, limit: 3 }), [{ kind: 'starter' }]);
  assert.deepEqual(focusSuggestions({ now, records: [], tasks: null, subjects: null, goal: null, limit: 0 }), []);
});
