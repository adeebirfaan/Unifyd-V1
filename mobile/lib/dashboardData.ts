import { buildDashboardFacts, dashboardMonth, dashboardWellnessWindow } from '@/lib/dashboardFacts';
import type { DashboardExpense, DashboardFacts, DashboardMood, DashboardTask } from '@/lib/dashboardFacts';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 500;

type Page<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;

async function readAll<T>(page: Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) return rows;
  }
}

/** Reads only the signed-in student's rows needed for Home; RLS remains the boundary. */
export async function loadDashboardFacts(userId: string, now = new Date()): Promise<DashboardFacts> {
  const month = dashboardMonth(now);
  const window = dashboardWellnessWindow(now);
  const [budget, expenses, tasks, moods] = await Promise.all([
    supabase.from('budgets').select('amount').eq('user_id', userId).eq('period_type', 'monthly').eq('period_start', month.start).maybeSingle(),
    readAll<DashboardExpense>((from, to) => supabase.from('expenses').select('amount,category,expense_date')
      .eq('user_id', userId).gte('expense_date', month.start).lte('expense_date', month.end).order('id').range(from, to)),
    readAll<DashboardTask>((from, to) => supabase.from('tasks').select('title,subject,deadline,status,completed_at')
      .eq('user_id', userId).order('id').range(from, to)),
    readAll<DashboardMood>((from, to) => supabase.from('mood_entries').select('mood_level,stress_level,recorded_at')
      .eq('user_id', userId).gte('recorded_at', window.previousStart.toISOString()).lt('recorded_at', window.endExclusive.toISOString())
      .order('id').range(from, to)),
  ]);
  if (budget.error) throw budget.error;
  return buildDashboardFacts({ expenses, tasks, moods, now, monthlyBudget: (budget.data as { amount: number | string } | null)?.amount ?? null });
}
