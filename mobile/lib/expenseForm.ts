export const EXPENSE_CATEGORIES = ['food', 'transport', 'academic_materials', 'personal', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseInput = {
  title: string;
  amount: number;
  category: ExpenseCategory;
  expense_date: string;
  notes: string | null;
};

export function localDateISO(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return year >= 1 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function parseExpenseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) && amount > 0 && amount <= 9999999999.99 ? amount : null;
}
