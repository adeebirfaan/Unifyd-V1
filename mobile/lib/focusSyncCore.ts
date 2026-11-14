import type { PendingReflection } from '@/lib/focusStorage';
import type { FocusBlock } from '@/lib/focusTimer';

/**
 * Unifyd Focus sync rules (pure; storage, network, and session are injected so they can be tested with fakes).
 * Kept rounds wait in the on-device outbox until the database confirms each one. Nothing is ever dropped:
 * a round leaves the outbox only after its insert succeeded, or after the database shows the same round already
 * belongs to this student. Rounds the database refuses stay on the device and are counted as "not synced".
 */
export type FocusSessionRow = {
  id: string; user_id: string; semester_course_id: string | null; subject_label: string | null; task_id: string | null; task_title: string | null;
  preset: FocusBlock['preset']; planned_focus_seconds: number; focus_seconds: number; round_number: number; started_at: string; ended_at: string;
  status: FocusBlock['status'];
};
export type DbError = { code?: string; message?: string } | null;
export type InsertFailure = 'duplicate' | 'link' | 'invalid' | 'retry';

const SUBJECT_MAX = 300;
const TASK_MAX = 500;
const PLANNED_MIN = 300;
const PLANNED_MAX = 7200;
const PARTIAL_MIN = 60;

function label(value: string | null | undefined, max: number): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : null;
}

/**
 * The database row for a kept round, made to fit the table's checks without changing what was recorded:
 * a link without its readable copy is dropped (older Phase 2 rounds have no task title), and a start time
 * that a changed device clock left too close to the end is moved back so the span covers the focus time.
 * Returns null only when the round cannot be read at all.
 */
export function toFocusRow(block: FocusBlock, userId: string): FocusSessionRow | null {
  const ended = Date.parse(block.endedAt);
  let started = Date.parse(block.startedAt);
  if (!Number.isFinite(ended) || !Number.isFinite(started)) return null;
  const planned = Math.round(block.plannedFocusSeconds);
  if (!Number.isFinite(planned) || planned < PLANNED_MIN || planned > PLANNED_MAX) return null;
  const focus = Math.max(0, Math.min(planned, Math.floor(block.focusSeconds)));
  const status: FocusBlock['status'] = focus >= planned ? 'completed' : 'partial';
  if (status === 'partial' && focus < PARTIAL_MIN) return null;
  if (ended - started < focus * 1000) started = ended - focus * 1000;
  const subject = label(block.subjectLabel, SUBJECT_MAX);
  const taskTitle = label(block.taskTitle, TASK_MAX);
  return {
    id: block.id, user_id: userId,
    semester_course_id: subject ? block.courseId : null, subject_label: subject,
    task_id: taskTitle ? block.taskId : null, task_title: taskTitle,
    preset: block.preset, planned_focus_seconds: planned, focus_seconds: focus, round_number: Math.max(1, Math.round(block.roundNumber) || 1),
    started_at: new Date(started).toISOString(), ended_at: new Date(ended).toISOString(), status,
  };
}

/** The same round without its links; the readable subject and task copies stay. */
export function withoutLinks(row: FocusSessionRow): FocusSessionRow {
  return { ...row, semester_course_id: null, task_id: null };
}

const hasLinks = (row: FocusSessionRow) => row.semester_course_id !== null || row.task_id !== null;

/**
 * What a failed insert means. Duplicate: this ID exists (check whose). Link: the task or subject is gone or not the
 * student's (foreign key or row-level check). Invalid: the row breaks a table check, so retrying will not help.
 * Retry: anything else, including no network, a timeout, a server error, or a table that does not exist yet.
 */
export function classifyInsertError(error: DbError): InsertFailure {
  const code = error?.code ?? '';
  if (code === '23505') return 'duplicate';
  if (code === '23503' || code === '42501') return 'link';
  if (code === '23514' || code === '23502' || code.startsWith('22')) return 'invalid';
  return 'retry';
}

export type FocusSyncDeps = {
  /** The signed-in student right now, or null. Checked before every insert. */
  currentUserId: () => Promise<string | null>;
  loadPending: (userId: string) => Promise<FocusBlock[]>;
  removePending: (userId: string, ids: readonly string[]) => Promise<void>;
  replaceId: (userId: string, oldId: string, newId: string) => Promise<void>;
  insert: (row: FocusSessionRow) => Promise<{ error: DbError }>;
  /** true when this ID is already one of the student's rows, false when it is not, null when the check failed. */
  ownsRow: (userId: string, id: string) => Promise<boolean | null>;
  newId: () => string;
};
export type FocusSyncStop = 'offline' | 'wrongUser' | null;
export type FocusSyncResult = { pending: number; synced: number; rejected: number; stopped: FocusSyncStop };

type Attempt = 'synced' | 'rejected' | 'stop' | 'wrongUser';

async function saveRow(userId: string, block: FocusBlock, deps: FocusSyncDeps): Promise<Attempt> {
  let row = toFocusRow(block, userId);
  if (!row) return 'rejected';
  let linksDropped = false;
  let idChanged = false;
  // At most a few steps: drop links once, change the ID once.
  for (let step = 0; step < 4; step++) {
    if (await deps.currentUserId() !== userId) return 'wrongUser';
    const { error } = await deps.insert(row);
    if (!error) { await deps.removePending(userId, [row.id]); return 'synced'; }
    const failure = classifyInsertError(error);
    if (failure === 'duplicate') {
      const owned = await deps.ownsRow(userId, row.id);
      if (owned === null) return 'stop';
      if (owned) { await deps.removePending(userId, [row.id]); return 'synced'; }
      // The ID belongs to a row this student cannot see: keep the round under a fresh ID and try again.
      if (idChanged) return 'rejected';
      const next = deps.newId();
      await deps.replaceId(userId, row.id, next);
      row = { ...row, id: next };
      idChanged = true;
    } else if (failure === 'link') {
      // The linked task or subject was deleted (or is not the student's): keep the round with its readable copies.
      if (linksDropped || !hasLinks(row)) return 'stop';
      row = withoutLinks(row);
      linksDropped = true;
    } else if (failure === 'invalid') return 'rejected';
    else return 'stop';
  }
  return 'rejected';
}

/** Sends every pending round for this student, oldest first. Stops at the first sign of no network or a session change. */
export async function runFocusSync(userId: string, deps: FocusSyncDeps): Promise<FocusSyncResult> {
  let synced = 0;
  let rejected = 0;
  let stopped: FocusSyncStop = null;
  if (await deps.currentUserId() !== userId) stopped = 'wrongUser';
  else {
    for (const block of await deps.loadPending(userId)) {
      const result = await saveRow(userId, block, deps).catch((): Attempt => 'stop');
      if (result === 'synced') synced++;
      else if (result === 'rejected') rejected++;
      else { stopped = result === 'wrongUser' ? 'wrongUser' : 'offline'; break; }
    }
  }
  const pending = (await deps.loadPending(userId).catch(() => [])).length;
  return { pending, synced, rejected, stopped };
}

/**
 * Phase 5 reflections. A reflection is sent only after its round is saved (it waits while the round is still on the
 * device). The update sets it only where the round is the student's own, completed, and still without a reflection,
 * so the first answer always wins and a retry can never change it. It leaves the device when the update succeeded,
 * when the round already has a reflection, or when the round no longer exists; anything else waits.
 */
export type ReflectionDeps = {
  currentUserId: () => Promise<string | null>;
  loadReflections: (userId: string) => Promise<PendingReflection[]>;
  removeReflection: (userId: string, id: string) => Promise<void>;
  pendingRoundIds: (userId: string) => Promise<string[]>;
  /** Sets the reflection where it is still empty; `updated` is false when no row matched. */
  updateReflection: (userId: string, id: string, reflection: PendingReflection['reflection']) => Promise<{ error: DbError; updated: boolean }>;
  /** Whether the round exists for this student (null when the check failed). */
  roundExists: (userId: string, id: string) => Promise<boolean | null>;
};
export type ReflectionSyncResult = { pending: number; saved: number; stopped: FocusSyncStop };

export async function runReflectionSync(userId: string, deps: ReflectionDeps): Promise<ReflectionSyncResult> {
  let saved = 0;
  let stopped: FocusSyncStop = null;
  if (await deps.currentUserId() !== userId) stopped = 'wrongUser';
  else {
    const waitingRounds = new Set(await deps.pendingRoundIds(userId));
    for (const item of await deps.loadReflections(userId)) {
      if (waitingRounds.has(item.id)) continue;
      if (await deps.currentUserId() !== userId) { stopped = 'wrongUser'; break; }
      const result = await deps.updateReflection(userId, item.id, item.reflection).catch(() => ({ error: { message: 'request failed' }, updated: false }));
      if (result.error) {
        // A value the table can never accept (for example on a partial round) is dropped; everything else waits.
        if (classifyInsertError(result.error) === 'invalid') { await deps.removeReflection(userId, item.id); continue; }
        stopped = 'offline'; break;
      }
      if (result.updated) { await deps.removeReflection(userId, item.id); saved++; continue; }
      const exists = await deps.roundExists(userId, item.id).catch(() => null);
      if (exists === null) { stopped = 'offline'; break; }
      // The round already has a reflection (the first answer stays) or was deleted: nothing more to send.
      await deps.removeReflection(userId, item.id);
    }
  }
  const pending = (await deps.loadReflections(userId).catch(() => [])).length;
  return { pending, saved, stopped };
}
