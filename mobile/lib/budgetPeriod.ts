import { localDateISO } from '@/lib/expenseForm';

export type BudgetPeriodType = 'weekly' | 'monthly';
export type BudgetRecord = { id: string; amount: number | string; period_type: BudgetPeriodType; period_start: string };

export function currentBudgetPeriod(type: BudgetPeriodType, today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  // Construct local calendar dates. UTC conversion can shift a budget into another day.
  const start = type === 'monthly'
    ? new Date(year, month, 1, 12)
    : new Date(year, month, day - ((today.getDay() + 6) % 7), 12);
  const end = type === 'monthly'
    ? new Date(year, month + 1, 0, 12)
    : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 12);
  return { start: localDateISO(start), end: localDateISO(end) };
}

function calendarOrdinal(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function elapsedPeriodDays(start: string, end: string, today = new Date()): number {
  const totalDays = calendarOrdinal(end) - calendarOrdinal(start) + 1;
  const elapsed = calendarOrdinal(localDateISO(today)) - calendarOrdinal(start) + 1;
  return Math.max(1, Math.min(totalDays, elapsed));
}
