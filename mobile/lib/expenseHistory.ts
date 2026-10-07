import type { LanguagePreference } from '@/constants/i18n';
import type { ExpenseCategory } from '@/lib/expenseForm';

export type ExpenseRecord = {
  id: string;
  title: string;
  amount: number | string;
  category: ExpenseCategory;
  expense_date: string;
  notes: string | null;
  created_at: string;
};

export type ExpenseDetail = ExpenseRecord & { entry_source: 'manual' | 'ocr' };

export function expenseTotalCents(expenses: readonly ExpenseRecord[]): number {
  return expenses.reduce((total, expense) => total + Math.round(Number(expense.amount) * 100), 0);
}

export function formatRinggit(amount: number): string {
  return `RM ${new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

export function formatExpenseDate(isoDate: string, language: LanguagePreference): string {
  const locale = language === 'ms' ? 'ms-MY' : 'en-MY';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${isoDate}T00:00:00Z`));
}
