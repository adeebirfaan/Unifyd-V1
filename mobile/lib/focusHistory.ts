import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeGoal, recordFromRow } from '@/lib/focusInsights';
import type { FocusGoal, FocusRecord, FocusRow } from '@/lib/focusInsights';
import { supabase } from '@/lib/supabase';

/**
 * Reads the student's synced Focus rounds (`focus_sessions`, owner-only RLS, always filtered by `user_id`) and the
 * optional focus goal. The goal is a device preference (`unifyd:focus-goal:<userId>`), like quick actions and card
 * shades, so it needs no database table.
 */
const COLUMNS = 'id,subject_label,task_title,focus_seconds,planned_focus_seconds,status,started_at,ended_at';
const PAGE_SIZE = 500;
export const HISTORY_PAGE = 20;
const goalKey = (userId: string) => `unifyd:focus-goal:${userId}`;

/** Every synced round that started on or after `since` (the summary window), newest first. */
export async function loadFocusRecords(userId: string, since: Date): Promise<FocusRecord[]> {
  const records: FocusRecord[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from('focus_sessions').select(COLUMNS)
      .eq('user_id', userId).gte('started_at', since.toISOString())
      .order('started_at', { ascending: false }).order('id').range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as FocusRow[];
    records.push(...page.map(recordFromRow));
    if (page.length < PAGE_SIZE) break;
  }
  return records;
}

/** One page of history, newest first; `more` is true when an older page exists. */
export async function loadFocusHistoryPage(userId: string, offset: number): Promise<{ records: FocusRecord[]; more: boolean }> {
  const { data, error } = await supabase.from('focus_sessions').select(COLUMNS)
    .eq('user_id', userId).order('started_at', { ascending: false }).order('id').range(offset, offset + HISTORY_PAGE);
  if (error) throw error;
  const rows = (data ?? []) as FocusRow[];
  return { records: rows.slice(0, HISTORY_PAGE).map(recordFromRow), more: rows.length > HISTORY_PAGE };
}

export async function readFocusGoal(userId: string): Promise<FocusGoal | null> {
  try {
    const raw = await AsyncStorage.getItem(goalKey(userId));
    return raw ? normalizeGoal(JSON.parse(raw)) : null;
  } catch { return null; }
}

/** Saves the goal, or removes it when null ("Off"). */
export async function writeFocusGoal(userId: string, goal: FocusGoal | null): Promise<void> {
  if (goal) await AsyncStorage.setItem(goalKey(userId), JSON.stringify(goal));
  else await AsyncStorage.removeItem(goalKey(userId));
}

const poofHiddenKey = (userId: string) => `unifyd:focus-poof-hidden:${userId}`;

/** Whether the student hid Poof on Focus (a device preference; shown by default). */
export async function readPoofHidden(userId: string): Promise<boolean> {
  try { return (await AsyncStorage.getItem(poofHiddenKey(userId))) === '1'; } catch { return false; }
}

export async function writePoofHidden(userId: string, hidden: boolean): Promise<void> {
  if (hidden) await AsyncStorage.setItem(poofHiddenKey(userId), '1');
  else await AsyncStorage.removeItem(poofHiddenKey(userId));
}
