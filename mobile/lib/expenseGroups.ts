import type { ExpenseRecord } from '@/lib/expenseHistory';

export type ExpenseDateGroup<T> = { date: string; totalCents: number; expenses: T[] };
export type RelativeDay = 'today' | 'yesterday' | null;

/**
 * Groups expenses by their stored `expense_date`, a local calendar date ("YYYY-MM-DD") with no time part,
 * so a single day can never be split by time of day or time zone. Groups are newest date first; rows keep
 * the order they arrive in (the existing newest-first history order). Expenses from several loaded pages
 * merge into one group per date, so no date is ever repeated, and every group has at least one row.
 * Totals are summed in integer cents, as everywhere else in Wallet.
 */
export function groupExpensesByDate<T extends Pick<ExpenseRecord, 'expense_date' | 'amount'>>(expenses: readonly T[]): ExpenseDateGroup<T>[] {
  const groups = new Map<string, ExpenseDateGroup<T>>();
  for (const expense of expenses) {
    const group = groups.get(expense.expense_date) ?? { date: expense.expense_date, totalCents: 0, expenses: [] };
    group.expenses.push(expense);
    group.totalCents += Math.round(Number(expense.amount) * 100);
    groups.set(expense.expense_date, group);
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** "today" or "yesterday" for the device's current local date, otherwise null (show the full date). */
export function relativeDay(isoDate: string, todayISO: string): RelativeDay {
  if (isoDate === todayISO) return 'today';
  const [year, month, day] = todayISO.split('-').map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  return isoDate === yesterday ? 'yesterday' : null;
}
