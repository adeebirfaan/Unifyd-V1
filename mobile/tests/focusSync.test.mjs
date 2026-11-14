import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyInsertError, runFocusSync, runReflectionSync, toFocusRow, withoutLinks } from '../lib/focusSyncCore.ts';

const A = 'user-a';
const B = 'user-b';
const T0 = Date.UTC(2026, 9, 16, 2, 0);
const iso = (ms) => new Date(T0 + ms).toISOString();
const block = (id, fields = {}) => ({
  id, status: 'completed', preset: 'classic', plannedFocusSeconds: 1500, focusSeconds: 1500, roundNumber: 1,
  startedAt: iso(0), endedAt: iso(1500_000), courseId: null, subjectLabel: null, taskId: null, taskTitle: null, ...fields,
});

/**
 * A fake device outbox per student and a fake `focus_sessions` table with owner rules: a duplicate ID fails with
 * 23505, a link to a missing or foreign task/subject fails with 42501, and `fail` can inject other errors.
 */
function world({ user = A, outbox = {}, rows = [], ownTasks = ['t1'], ownCourses = ['c1'], fail = () => null } = {}) {
  const state = { user, outbox: structuredClone(outbox), rows: new Map(rows.map((row) => [row.id, row])), inserts: [], ids: 0 };
  const deps = {
    currentUserId: async () => state.user,
    loadPending: async (userId) => structuredClone(state.outbox[userId] ?? []),
    removePending: async (userId, ids) => { state.outbox[userId] = (state.outbox[userId] ?? []).filter((item) => !ids.includes(item.id)); },
    replaceId: async (userId, oldId, newId) => { state.outbox[userId] = state.outbox[userId].map((item) => item.id === oldId ? { ...item, id: newId } : item); },
    insert: async (row) => {
      state.inserts.push(row);
      const injected = fail(row, state);
      if (injected) return { error: injected };
      if (row.user_id !== state.user) return { error: { code: '42501' } };
      if (state.rows.has(row.id)) return { error: { code: '23505' } };
      if ((row.task_id && !ownTasks.includes(row.task_id)) || (row.semester_course_id && !ownCourses.includes(row.semester_course_id))) return { error: { code: '42501' } };
      state.rows.set(row.id, row);
      return { error: null };
    },
    ownsRow: async (userId, id) => state.rows.has(id) ? state.rows.get(id).user_id === userId : false,
    newId: () => `fresh-${++state.ids}`,
  };
  return { state, deps };
}

test('a completed round becomes one row with real focus time only; links keep their readable copies', () => {
  const row = toFocusRow(block('r1', { courseId: 'c1', subjectLabel: ' BCS3153 — Software Evolution ', taskId: 't1', taskTitle: 'Revise chapter 4', roundNumber: 2,
    startedAt: iso(0), endedAt: iso(1800_000) }), A);
  assert.deepEqual(row, {
    id: 'r1', user_id: A, semester_course_id: 'c1', subject_label: 'BCS3153 — Software Evolution', task_id: 't1', task_title: 'Revise chapter 4',
    preset: 'classic', planned_focus_seconds: 1500, focus_seconds: 1500, round_number: 2, started_at: iso(0), ended_at: iso(1800_000), status: 'completed',
  });
  const partial = toFocusRow(block('r2', { status: 'partial', focusSeconds: 200, endedAt: iso(900_000) }), A);
  assert.equal(partial.status, 'partial');
  assert.equal(partial.focus_seconds, 200);
  assert.deepEqual(withoutLinks(row), { ...row, semester_course_id: null, task_id: null });
});

test('rows always fit the table checks without inventing time', () => {
  // A Phase 2 round linked to a task but saved without its title drops the link, not the round.
  assert.equal(toFocusRow(block('a', { taskId: 't1' }), A).task_id, null);
  assert.equal(toFocusRow(block('b', { courseId: 'c1', subjectLabel: '  ' }), A).semester_course_id, null);
  // A device clock moved back mid-round: the start moves back so the span covers the focus time.
  const moved = toFocusRow(block('c', { startedAt: iso(0), endedAt: iso(600_000) }), A);
  assert.equal(moved.started_at, iso(600_000 - 1500_000));
  assert.equal(moved.focus_seconds, 1500);
  // Labels are trimmed to the table limits.
  assert.equal(toFocusRow(block('d', { subjectLabel: 'x'.repeat(400), taskId: 't', taskTitle: 'y'.repeat(600) }), A).subject_label.length, 300);
  // Focus time never exceeds the plan; a partial round at the plan is a completed round.
  assert.equal(toFocusRow(block('e', { status: 'partial', focusSeconds: 9999 }), A).status, 'completed');
  for (const bad of [{ endedAt: 'x' }, { plannedFocusSeconds: 60 }, { plannedFocusSeconds: 9000 }, { status: 'partial', focusSeconds: 59 }]) {
    assert.equal(toFocusRow(block('z', bad), A), null, JSON.stringify(bad));
  }
});

test('insert errors are classified so only safe cases are retried differently', () => {
  assert.deepEqual(['23505', '23503', '42501', '23514', '23502', '22P02', 'PGRST205', '', undefined].map((code) => classifyInsertError({ code })),
    ['duplicate', 'link', 'link', 'invalid', 'invalid', 'invalid', 'retry', 'retry', 'retry']);
  assert.equal(classifyInsertError({ message: 'TypeError: Failed to fetch' }), 'retry');
});

test('successful sync sends each kept round once and empties the outbox; a second run sends nothing', async () => {
  const { state, deps } = world({ outbox: { [A]: [block('r1'), block('r2', { status: 'partial', focusSeconds: 300 })] } });
  assert.deepEqual(await runFocusSync(A, deps), { pending: 0, synced: 2, rejected: 0, stopped: null });
  assert.deepEqual([...state.rows.keys()], ['r1', 'r2']);
  assert.equal(state.rows.get('r2').status, 'partial');
  assert.deepEqual(state.outbox[A], []);
  assert.deepEqual(await runFocusSync(A, deps), { pending: 0, synced: 0, rejected: 0, stopped: null });
  assert.equal(state.inserts.length, 2);
});

test('a duplicate ID already owned by this student counts as synced, with no second row', async () => {
  const { state, deps } = world({ outbox: { [A]: [block('r1')] }, rows: [{ id: 'r1', user_id: A }] });
  assert.deepEqual(await runFocusSync(A, deps), { pending: 0, synced: 1, rejected: 0, stopped: null });
  assert.equal(state.rows.size, 1);
});

test('a duplicate ID owned by someone else is never treated as synced: the round gets a fresh ID', async () => {
  const { state, deps } = world({ outbox: { [A]: [block('taken')] }, rows: [{ id: 'taken', user_id: B }] });
  assert.deepEqual(await runFocusSync(A, deps), { pending: 0, synced: 1, rejected: 0, stopped: null });
  assert.equal(state.rows.get('taken').user_id, B);
  assert.equal(state.rows.get('fresh-1').user_id, A);
});

test('when the duplicate check itself fails, the round stays on the device', async () => {
  const { state, deps } = world({ outbox: { [A]: [block('r1')] }, rows: [{ id: 'r1', user_id: A }] });
  deps.ownsRow = async () => null;
  assert.deepEqual(await runFocusSync(A, deps), { pending: 1, synced: 0, rejected: 0, stopped: 'offline' });
  assert.equal(state.outbox[A].length, 1);
});

test('no network part-way: synced rounds leave, the rest wait, and the next run finishes the job', async () => {
  let offline = false;
  const { state, deps } = world({ outbox: { [A]: [block('r1'), block('r2'), block('r3')] }, fail: (row) => offline && row.id !== 'r1' ? { message: 'TypeError: Failed to fetch' } : null });
  offline = true;
  assert.deepEqual(await runFocusSync(A, deps), { pending: 2, synced: 1, rejected: 0, stopped: 'offline' });
  assert.deepEqual(state.outbox[A].map((item) => item.id), ['r2', 'r3']);
  // A timeout or a thrown error behaves the same: nothing is lost.
  deps.insert = async () => { throw new Error('AbortError'); };
  assert.deepEqual(await runFocusSync(A, deps), { pending: 2, synced: 0, rejected: 0, stopped: 'offline' });
  offline = false;
  const fresh = world({ outbox: state.outbox, rows: [...state.rows.values()] });
  assert.deepEqual(await runFocusSync(A, fresh.deps), { pending: 0, synced: 2, rejected: 0, stopped: null });
  assert.deepEqual([...fresh.state.rows.keys()], ['r1', 'r2', 'r3']);
});

test('the table not existing yet (before the migration) keeps every round waiting', async () => {
  const { state, deps } = world({ outbox: { [A]: [block('r1')] }, fail: () => ({ code: 'PGRST205', message: 'Could not find the table' }) });
  assert.deepEqual(await runFocusSync(A, deps), { pending: 1, synced: 0, rejected: 0, stopped: 'offline' });
  assert.equal(state.outbox[A].length, 1);
});

test('a deleted or foreign task or subject: the round is saved without the link, keeping its readable copies', async () => {
  const { state, deps } = world({ ownTasks: [], ownCourses: [],
    outbox: { [A]: [block('r1', { courseId: 'someone-elses', subjectLabel: 'BCS2243 — Database Systems', taskId: 'gone', taskTitle: 'Quiz prep' })] } });
  assert.deepEqual(await runFocusSync(A, deps), { pending: 0, synced: 1, rejected: 0, stopped: null });
  assert.deepEqual(state.rows.get('r1'), { ...state.inserts[0], semester_course_id: null, task_id: null });
  assert.equal(state.rows.get('r1').subject_label, 'BCS2243 — Database Systems');
  assert.equal(state.rows.get('r1').task_title, 'Quiz prep');
  assert.equal(state.inserts.length, 2);
});

test('a round the table refuses stays on the device, is counted, and does not block the others', async () => {
  const { state, deps } = world({ outbox: { [A]: [block('bad'), block('ok'), block('unreadable', { endedAt: 'x' })] }, fail: (row) => row.id === 'bad' ? { code: '23514' } : null });
  assert.deepEqual(await runFocusSync(A, deps), { pending: 2, synced: 1, rejected: 2, stopped: null });
  assert.deepEqual(state.outbox[A].map((item) => item.id), ['bad', 'unreadable']);
});

test('rounds are never sent under another account, and each student keeps their own outbox', async () => {
  const { state, deps } = world({ user: B, outbox: { [A]: [block('a1')], [B]: [block('b1')] } });
  assert.deepEqual(await runFocusSync(A, deps), { pending: 1, synced: 0, rejected: 0, stopped: 'wrongUser' });
  assert.equal(state.inserts.length, 0);
  assert.deepEqual(await runFocusSync(B, deps), { pending: 0, synced: 1, rejected: 0, stopped: null });
  assert.deepEqual(state.outbox[A].map((item) => item.id), ['a1']);
  assert.equal(state.rows.get('b1').user_id, B);
  // Signed out (or switched) part-way through a run: the run stops before the next insert.
  const mid = world({ outbox: { [A]: [block('x1'), block('x2')] } });
  const insert = mid.deps.insert;
  mid.deps.insert = async (row) => { const result = await insert(row); mid.state.user = null; return result; };
  assert.deepEqual(await runFocusSync(A, mid.deps), { pending: 1, synced: 1, rejected: 0, stopped: 'wrongUser' });
  assert.equal(mid.state.inserts.length, 1);
});

/** A fake reflection outbox and table rows: an update succeeds once per round, only on a completed round with none set. */
function reflectionWorld({ user = A, outbox = [], rows = [], pendingRounds = [], fail = () => null } = {}) {
  const state = { user, outbox: structuredClone(outbox), rows: new Map(rows.map((row) => [row.id, { ...row }])), updates: [] };
  const deps = {
    currentUserId: async () => state.user,
    loadReflections: async () => structuredClone(state.outbox),
    removeReflection: async (_userId, id) => { state.outbox = state.outbox.filter((item) => item.id !== id); },
    pendingRoundIds: async () => pendingRounds,
    updateReflection: async (userId, id, reflection) => {
      state.updates.push([id, reflection]);
      const injected = fail(id);
      if (injected) return { error: injected, updated: false };
      const row = state.rows.get(id);
      if (!row || row.user_id !== userId || row.reflection !== null || row.status !== 'completed') return { error: null, updated: false };
      row.reflection = reflection;
      return { error: null, updated: true };
    },
    roundExists: async (userId, id) => state.rows.has(id) && state.rows.get(id).user_id === userId,
  };
  return { state, deps };
}

test('a reflection is saved once on its own completed round; the first answer always wins', async () => {
  const { state, deps } = reflectionWorld({ outbox: [{ id: 'r1', reflection: 'great' }], rows: [{ id: 'r1', user_id: A, status: 'completed', reflection: null }] });
  assert.deepEqual(await runReflectionSync(A, deps), { pending: 0, saved: 1, stopped: null });
  assert.equal(state.rows.get('r1').reflection, 'great');
  // A second answer for the same round (for example from another device) never changes it.
  state.outbox = [{ id: 'r1', reflection: 'tired' }];
  assert.deepEqual(await runReflectionSync(A, deps), { pending: 0, saved: 0, stopped: null });
  assert.equal(state.rows.get('r1').reflection, 'great');
});

test('a reflection waits while its round is still on the device, and offline, and before the column exists', async () => {
  const waiting = reflectionWorld({ outbox: [{ id: 'r1', reflection: 'okay' }], pendingRounds: ['r1'] });
  assert.deepEqual(await runReflectionSync(A, waiting.deps), { pending: 1, saved: 0, stopped: null });
  assert.equal(waiting.state.updates.length, 0);
  for (const error of [{ message: 'TypeError: Failed to fetch' }, { code: 'PGRST204', message: "Could not find the 'reflection' column" }, { code: '42703' }]) {
    const offline = reflectionWorld({ outbox: [{ id: 'r1', reflection: 'okay' }], rows: [{ id: 'r1', user_id: A, status: 'completed', reflection: null }], fail: () => error });
    assert.deepEqual(await runReflectionSync(A, offline.deps), { pending: 1, saved: 0, stopped: 'offline' }, JSON.stringify(error));
  }
});

test('reflections for deleted rounds are let go, and none are ever sent under another account', async () => {
  const gone = reflectionWorld({ outbox: [{ id: 'deleted', reflection: 'tired' }] });
  assert.deepEqual(await runReflectionSync(A, gone.deps), { pending: 0, saved: 0, stopped: null });
  const other = reflectionWorld({ user: B, outbox: [{ id: 'r1', reflection: 'great' }], rows: [{ id: 'r1', user_id: A, status: 'completed', reflection: null }] });
  assert.deepEqual(await runReflectionSync(A, other.deps), { pending: 1, saved: 0, stopped: 'wrongUser' });
  assert.equal(other.state.updates.length, 0);
  // A check that cannot complete keeps the reflection.
  const unsure = reflectionWorld({ outbox: [{ id: 'r1', reflection: 'great' }], rows: [] });
  unsure.deps.roundExists = async () => null;
  assert.deepEqual(await runReflectionSync(A, unsure.deps), { pending: 1, saved: 0, stopped: 'offline' });
});
