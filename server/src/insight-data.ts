import { createClient } from '@supabase/supabase-js';

import { buildInsightFacts, currentMonth, wellnessWindow } from './insight-facts.js';
import type { ExpenseRow, InsightFacts, MoodRow, TaskRow } from './insight-facts.js';

const PAGE_SIZE = 1000;

type Page<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;

async function readAll<T>(page: Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error('A dashboard query failed.');
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) return rows;
  }
}

/**
 * Loads the caller's own records with a client that carries their access token,
 * so Supabase Row Level Security still limits every query to that student.
 */
export async function loadInsightFacts(url: string, publishableKey: string, token: string, timeZone: string, now: Date): Promise<{ userId: string; facts: InsightFacts }> {
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await client.auth.getUser(token);
  const userId = auth.user?.id;
  if (authError || !userId) throw new Error('The caller could not be verified.');

  const month = currentMonth(now, timeZone);
  const window = wellnessWindow(now, timeZone);
  const [budget, expenses, tasks, moods] = await Promise.all([
    client.from('budgets').select('amount').eq('user_id', userId).eq('period_type', 'monthly').eq('period_start', month.start).maybeSingle(),
    readAll<ExpenseRow>((from, to) => client.from('expenses').select('amount,category,expense_date')
      .eq('user_id', userId).gte('expense_date', month.start).lte('expense_date', month.end).order('id').range(from, to)),
    readAll<TaskRow>((from, to) => client.from('tasks').select('title,subject,deadline,status,completed_at')
      .eq('user_id', userId).order('id').range(from, to)),
    readAll<MoodRow>((from, to) => client.from('mood_entries').select('mood_level,stress_level,recorded_at')
      .eq('user_id', userId).gte('recorded_at', window.previousStart.toISOString()).lt('recorded_at', window.endExclusive.toISOString())
      .order('id').range(from, to)),
  ]);
  if (budget.error) throw new Error('A dashboard query failed.');

  return {
    userId,
    facts: buildInsightFacts({
      expenses, tasks, moods, now, timeZone,
      monthlyBudget: (budget.data as { amount: number | string } | null)?.amount ?? null,
    }),
  };
}
