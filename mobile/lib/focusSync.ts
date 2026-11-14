import { keepFocusReflection, loadFocusBlocks, loadFocusReflections, removeFocusBlocks, removeFocusReflection, replaceFocusBlockId } from '@/lib/focusStorage';
import type { FocusReflection } from '@/lib/focusStorage';
import { runFocusSync, runReflectionSync } from '@/lib/focusSyncCore';
import type { DbError, FocusSyncDeps, ReflectionDeps } from '@/lib/focusSyncCore';
import { newFocusId } from '@/lib/focusTimer';
import { supabase } from '@/lib/supabase';

/**
 * Sends kept Unifyd Focus rounds from the device outbox to `focus_sessions` (rules in `focusSyncCore.ts`).
 * Runs when a round is kept, when Focus opens, on sign-in, when the app returns to the foreground, and every
 * minute while rounds are still waiting. One run at a time per student; a request during a run queues one more.
 * Each request gives up after 15 s, and the rounds simply wait for the next run.
 */
export type FocusSyncStatus = {
  syncing: boolean;
  /** Rounds still only on this device. */
  pending: number;
  /** Of those, rounds the database refused in the last run (kept; retried on every run). */
  rejected: number;
  /** The last run stopped early (no network, a timeout, or a server error). */
  offline: boolean;
  /** At least one round reached the database since the app started. */
  syncedThisSession: boolean;
  /** Reflections still only on this device (sent after their round). */
  reflectionsPending: number;
};

const TIMEOUT_MS = 15_000;
const statuses = new Map<string, FocusSyncStatus>();
const listeners = new Set<() => void>();
const running = new Map<string, Promise<void>>();
const again = new Set<string>();
const EMPTY: FocusSyncStatus = { syncing: false, pending: 0, rejected: 0, offline: false, syncedThisSession: false, reflectionsPending: 0 };

async function timed<T extends { error: DbError }>(request: (signal: AbortSignal) => PromiseLike<T>): Promise<T | { error: DbError; data?: undefined }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { return await request(controller.signal); }
  catch (error) { return { error: { message: error instanceof Error ? error.name : 'request failed' } }; }
  finally { clearTimeout(timer); }
}

const deps: FocusSyncDeps = {
  currentUserId: async () => (await supabase.auth.getSession()).data.session?.user.id ?? null,
  loadPending: loadFocusBlocks,
  removePending: removeFocusBlocks,
  replaceId: replaceFocusBlockId,
  insert: async (row) => ({ error: (await timed((signal) => supabase.from('focus_sessions').insert(row).abortSignal(signal))).error }),
  ownsRow: async (userId, id) => {
    const result = await timed((signal) => supabase.from('focus_sessions').select('id').eq('id', id).eq('user_id', userId).abortSignal(signal).maybeSingle());
    return result.error ? null : !!result.data;
  },
  newId: () => newFocusId(),
};

const reflectionDeps: ReflectionDeps = {
  currentUserId: deps.currentUserId,
  loadReflections: loadFocusReflections,
  removeReflection: removeFocusReflection,
  pendingRoundIds: async (userId) => (await loadFocusBlocks(userId)).map((block) => block.id),
  updateReflection: async (userId, id, reflection) => {
    const result = await timed((signal) => supabase.from('focus_sessions').update({ reflection }).eq('id', id).eq('user_id', userId).is('reflection', null).select('id').abortSignal(signal));
    return { error: result.error, updated: !result.error && Array.isArray(result.data) && result.data.length > 0 };
  },
  roundExists: deps.ownsRow,
};

function publish(userId: string, status: FocusSyncStatus) {
  statuses.set(userId, status);
  for (const listener of listeners) listener();
}

/** The latest known status for this student (stable object between changes, for `useSyncExternalStore`). */
export function getFocusSyncStatus(userId: string | undefined): FocusSyncStatus {
  return (userId && statuses.get(userId)) || EMPTY;
}

export function subscribeFocusSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Starts a sync for this student, or queues one more if a run is already going. Never throws. */
export function syncFocusRounds(userId: string): Promise<void> {
  const current = running.get(userId);
  if (current) { again.add(userId); return current; }
  const run = (async () => {
    do {
      again.delete(userId);
      const before = getFocusSyncStatus(userId);
      publish(userId, { ...before, syncing: true });
      try {
        const result = await runFocusSync(userId, deps);
        // Reflections go after their rounds; a stop on rounds (no network, wrong account) skips them this time.
        const reflections = result.stopped ? null : await runReflectionSync(userId, reflectionDeps);
        publish(userId, {
          syncing: false, pending: result.pending, rejected: result.rejected, offline: result.stopped === 'offline' || reflections?.stopped === 'offline',
          syncedThisSession: before.syncedThisSession || result.synced > 0,
          reflectionsPending: reflections ? reflections.pending : (await loadFocusReflections(userId)).length,
        });
        if (result.stopped === 'wrongUser') break;
      } catch {
        publish(userId, { ...getFocusSyncStatus(userId), syncing: false, offline: true });
      }
    } while (again.has(userId));
  })().finally(() => { running.delete(userId); again.delete(userId); });
  running.set(userId, run);
  return run;
}

/**
 * True when the periodic retry could achieve something: rounds are waiting that the database has not refused, or
 * reflections are waiting after a run that stopped early. Refused rounds (and reflections waiting on them) are still
 * retried on app start, foreground, and when Focus opens, but not every minute (Phase 6: no pointless requests).
 */
export function hasPendingFocusRounds(userId: string): boolean {
  const status = getFocusSyncStatus(userId);
  return status.pending > status.rejected || (status.reflectionsPending > 0 && status.offline);
}

/**
 * Calls `onSaved` after a sync run that changed what is waiting on the device (a round or reflection was saved, or
 * a new one was kept), so screens reload their figures only when something actually changed.
 */
export function onFocusSyncChange(userId: string, onSaved: () => void): () => void {
  let previous = getFocusSyncStatus(userId);
  return subscribeFocusSync(() => {
    const next = getFocusSyncStatus(userId);
    if (previous.syncing && !next.syncing && (next.pending !== previous.pending || next.reflectionsPending !== previous.reflectionsPending || next.syncedThisSession !== previous.syncedThisSession)) onSaved();
    previous = next;
  });
}

/**
 * Keeps the student's reflection for a completed round on the device, then tries to save it. Returns false when
 * that round already has a reflection waiting (only one per round).
 */
export async function saveFocusReflection(userId: string, roundId: string, reflection: FocusReflection): Promise<boolean> {
  const kept = await keepFocusReflection(userId, roundId, reflection);
  if (kept) void syncFocusRounds(userId);
  return kept;
}
