import AsyncStorage from '@react-native-async-storage/async-storage';

import { applyFocusAction, newFocusId, parseFocusState } from '@/lib/focusTimer';
import type { FocusBlock, FocusState } from '@/lib/focusTimer';

/**
 * Unifyd Focus on-device storage, one entry per student:
 * - `unifyd:focus-session:<userId>`: the current timer state, written on every change (never every tick), so a
 *   restart or another screen picks it up where it was.
 * - `unifyd:focus-blocks:<userId>`: the outbox of kept rounds (completed or partial) waiting to be synced. They are
 *   never dropped by sign-out or a failed network; `lib/focusSync.ts` removes each one only after the database
 *   confirms it. Entries this version cannot read are kept as they are, and an unreadable list is copied to
 *   `unifyd:focus-blocks-unreadable:<userId>:<time>` before a new list starts, so no study history is ever overwritten.
 */
const stateKey = (userId: string) => `unifyd:focus-session:${userId}`;
const blocksKey = (userId: string) => `unifyd:focus-blocks:${userId}`;
const reflectionsKey = (userId: string) => `unifyd:focus-reflections:${userId}`;
const unreadableKey = (userId: string) => `unifyd:focus-blocks-unreadable:${userId}:${Date.now()}`;

// One read-modify-write at a time, so two quick changes can never overwrite each other's blocks.
let writes: Promise<unknown> = Promise.resolve();
function queue<T>(work: () => Promise<T>): Promise<T> {
  const result = writes.then(work, work);
  writes = result.catch(() => undefined);
  return result;
}

/** The stored state (read after any pending write), or null when there is none or it cannot be trusted. */
export function loadFocusState(userId: string): Promise<FocusState | null> {
  return queue(async () => {
    try {
      const raw = await AsyncStorage.getItem(stateKey(userId));
      return raw ? parseFocusState(JSON.parse(raw)) : null;
    } catch { return null; }
  });
}

export function saveFocusState(userId: string, state: FocusState): Promise<void> {
  return queue(() => AsyncStorage.setItem(stateKey(userId), JSON.stringify(state)));
}

function isBlock(value: unknown): value is FocusBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as Record<string, unknown>;
  return typeof block.id === 'string' && (block.status === 'completed' || block.status === 'partial') && typeof block.focusSeconds === 'number'
    && typeof block.plannedFocusSeconds === 'number' && typeof block.startedAt === 'string' && typeof block.endedAt === 'string';
}

const entryId = (entry: unknown) => (entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string' ? (entry as { id: string }).id : null);

/** Every stored entry, readable or not. An unreadable list is set aside (never deleted) and reads as empty. */
async function readEntries(userId: string): Promise<unknown[]> {
  const raw = await AsyncStorage.getItem(blocksKey(userId));
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) return value;
  } catch { /* set aside below */ }
  await AsyncStorage.setItem(unreadableKey(userId), raw);
  await AsyncStorage.removeItem(blocksKey(userId));
  return [];
}

/** Kept rounds waiting to sync, oldest first (entries this version cannot read are left out, not removed). */
export function loadFocusBlocks(userId: string): Promise<FocusBlock[]> {
  return queue(async () => (await readEntries(userId)).filter(isBlock)).catch(() => []);
}

/** Adds finished blocks; a block already kept (same ID) is never added twice. */
export function keepFocusBlocks(userId: string, blocks: readonly FocusBlock[]): Promise<void> {
  if (!blocks.length) return Promise.resolve();
  return queue(async () => {
    const entries = await readEntries(userId);
    const known = new Set(entries.map(entryId));
    const added = blocks.filter((block) => !known.has(block.id));
    if (added.length) await AsyncStorage.setItem(blocksKey(userId), JSON.stringify([...entries, ...added]));
  });
}

/** Removes rounds the database has confirmed. */
export function removeFocusBlocks(userId: string, ids: readonly string[]): Promise<void> {
  if (!ids.length) return Promise.resolve();
  const remove = new Set(ids);
  return queue(async () => {
    const entries = await readEntries(userId);
    const left = entries.filter((entry) => !remove.has(entryId(entry) ?? ''));
    if (left.length !== entries.length) await AsyncStorage.setItem(blocksKey(userId), JSON.stringify(left));
  });
}

/** Gives a waiting round a new ID (only when its ID is already taken by a row this student cannot see). */
export function replaceFocusBlockId(userId: string, oldId: string, newId: string): Promise<void> {
  return queue(async () => {
    const entries = await readEntries(userId);
    await AsyncStorage.setItem(blocksKey(userId), JSON.stringify(entries.map((entry) => entryId(entry) === oldId ? { ...(entry as object), id: newId } : entry)));
    // A reflection waiting for this round follows it to the new ID.
    const reflections = await readReflections(userId);
    if (reflections.some((item) => item.id === oldId)) {
      await AsyncStorage.setItem(reflectionsKey(userId), JSON.stringify(reflections.map((item) => item.id === oldId ? { ...item, id: newId } : item)));
    }
  });
}

/**
 * Reflections waiting to be saved (Phase 5), per student at `unifyd:focus-reflections:<userId>`: one per round,
 * and the first answer wins. They are sent after the round itself is saved and removed only once the database
 * shows the round has a reflection (or no longer exists).
 */
const REFLECTIONS = ['great', 'okay', 'struggled', 'tired'] as const;
export type FocusReflection = (typeof REFLECTIONS)[number];
export type PendingReflection = { id: string; reflection: FocusReflection };

export function isFocusReflection(value: unknown): value is FocusReflection {
  return typeof value === 'string' && (REFLECTIONS as readonly string[]).includes(value);
}

async function readReflections(userId: string): Promise<PendingReflection[]> {
  try {
    const raw = await AsyncStorage.getItem(reflectionsKey(userId));
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((item): item is PendingReflection => !!item && typeof item.id === 'string' && isFocusReflection(item.reflection)) : [];
  } catch { return []; }
}

export function loadFocusReflections(userId: string): Promise<PendingReflection[]> {
  return queue(() => readReflections(userId));
}

/** Keeps a reflection for a round; returns false (and keeps the first) when that round already has one. */
export function keepFocusReflection(userId: string, id: string, reflection: FocusReflection): Promise<boolean> {
  return queue(async () => {
    const items = await readReflections(userId);
    if (items.some((item) => item.id === id)) return false;
    await AsyncStorage.setItem(reflectionsKey(userId), JSON.stringify([...items, { id, reflection }]));
    return true;
  });
}

export function removeFocusReflection(userId: string, id: string): Promise<void> {
  return queue(async () => {
    const items = await readReflections(userId);
    if (items.some((item) => item.id === id)) await AsyncStorage.setItem(reflectionsKey(userId), JSON.stringify(items.filter((item) => item.id !== id)));
  });
}

/**
 * On sign-out: keeps any block the clock has finished and pauses a running phase, so time signed out is never
 * counted. The state stays on the device for the same student's next sign-in.
 */
export async function suspendFocusSession(userId: string, now = Date.now()): Promise<void> {
  const stored = await loadFocusState(userId);
  if (!stored) return;
  const { state, finished } = applyFocusAction(stored, { type: 'pause' }, now, newFocusId);
  await keepFocusBlocks(userId, finished);
  await saveFocusState(userId, state);
}
