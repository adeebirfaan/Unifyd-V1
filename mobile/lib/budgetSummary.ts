import { EXPENSE_CATEGORIES } from '@/lib/expenseForm';
import type { ExpenseCategory } from '@/lib/expenseForm';
import { elapsedPeriodDays } from '@/lib/budgetPeriod';

export type PeriodExpense = { amount: number | string; category: ExpenseCategory };
export type CategorySpending = { category: ExpenseCategory; cents: number; percentage: number };

export function calculateBudgetSummary(
  budgetAmount: number | string | null,
  expenses: readonly PeriodExpense[],
  periodStart: string,
  periodEnd: string,
  today = new Date(),
) {
  const categoryCents = new Map<ExpenseCategory, number>();
  for (const expense of expenses) {
    const cents = Math.round(Number(expense.amount) * 100);
    categoryCents.set(expense.category, (categoryCents.get(expense.category) ?? 0) + cents);
  }
  const spentCents = [...categoryCents.values()].reduce((sum, cents) => sum + cents, 0);
  const budgetCents = budgetAmount === null ? null : Math.round(Number(budgetAmount) * 100);
  const balanceCents = budgetCents === null ? null : budgetCents - spentCents;
  const elapsedDays = elapsedPeriodDays(periodStart, periodEnd, today);
  const categories: CategorySpending[] = EXPENSE_CATEGORIES
    .map((category) => ({ category, cents: categoryCents.get(category) ?? 0 }))
    .filter(({ cents }) => cents > 0)
    .map(({ category, cents }) => ({ category, cents, percentage: spentCents ? cents / spentCents * 100 : 0 }));
  return {
    budgetCents,
    spentCents,
    balanceCents,
    percentageUsed: budgetCents === null ? null : spentCents / budgetCents * 100,
    dailyAverage: spentCents / 100 / elapsedDays,
    elapsedDays,
    categories,
  };
}

export function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 1 }).format(value)}%`;
}
