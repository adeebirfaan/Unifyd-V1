import { useEffect, useState } from 'react';

import type { TranslationKey } from '@/constants/i18n';
import { useCategorySuggestion } from '@/hooks/useCategorySuggestion';
import { isValidISODate, localDateISO, parseExpenseAmount } from '@/lib/expenseForm';
import type { ExpenseCategory, ExpenseInput } from '@/lib/expenseForm';
import { useI18n } from '@/providers/LanguageProvider';

export type ExpenseDraftField = 'title' | 'amount' | 'category' | 'date';
export type ExpenseDraftErrors = Partial<Record<ExpenseDraftField, string>>;
export type ExpenseDraftInitial = { title: string; amount: string; category: ExpenseCategory | null; expenseDate: string; notes: string };

/**
 * Expense form state, validation, optional category suggestion, and save, shared by Add expense (`ExpenseForm`)
 * and the receipt Review step. `save` returns the first invalid field so a screen can scroll to it.
 */
export function useExpenseDraft({ initial, onSave, errorKey, suggestCategory = false }: {
  initial?: ExpenseDraftInitial;
  onSave: (input: ExpenseInput) => Promise<boolean>;
  errorKey: TranslationKey;
  /** Offer an optional category suggestion from the student's own past expenses (never applied automatically). */
  suggestCategory?: boolean;
}) {
  const { t } = useI18n();
  const [title, setTitleValue] = useState(initial?.title ?? '');
  const [amountText, setAmountValue] = useState(initial?.amount ?? '');
  const [category, setCategoryValue] = useState<ExpenseCategory | null>(initial?.category ?? null);
  const [expenseDate, setDateValue] = useState(initial?.expenseDate ?? localDateISO());
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<ExpenseDraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { state: suggestionState, request: requestSuggestion, clear: clearSuggestion } = useCategorySuggestion();
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [initialTitle] = useState(initial?.title ?? '');
  const [initialCategory] = useState(initial?.category ?? null);

  // An OCR draft arrives with a title already filled in, so it is checked once on open.
  useEffect(() => {
    if (suggestCategory && !initialCategory) requestSuggestion(initialTitle, 0);
  }, [suggestCategory, initialCategory, initialTitle, requestSuggestion]);

  const clearError = (field: ExpenseDraftField) => setErrors((current) => ({ ...current, [field]: undefined }));
  function setTitle(value: string) {
    setTitleValue(value);
    clearError('title');
    if (suggestCategory) { clearSuggestion(); if (!category && !suggestionDismissed) requestSuggestion(value); }
  }
  function setAmountText(value: string) { setAmountValue(value); clearError('amount'); }
  function setCategory(value: ExpenseCategory) { setCategoryValue(value); clearError('category'); }
  function setExpenseDate(value: string) { setDateValue(value); clearError('date'); }

  async function save(): Promise<ExpenseDraftField | null> {
    if (saving) return null;
    const amount = parseExpenseAmount(amountText);
    const nextErrors: ExpenseDraftErrors = {
      title: title.trim() ? undefined : t('expense.titleRequired'),
      amount: !amountText.trim() ? t('expense.amountRequired') : amount === null ? t('expense.amountInvalid') : undefined,
      category: category ? undefined : t('expense.categoryRequired'),
      date: isValidISODate(expenseDate) ? undefined : t('expense.dateRequired'),
    };
    setErrors(nextErrors);
    setSaveError(null);
    const firstInvalid = (['title', 'date', 'amount', 'category'] as const).find((field) => nextErrors[field]) ?? null;
    if (firstInvalid || amount === null || !category) return firstInvalid;

    setSaving(true);
    try {
      const success = await onSave({ title: title.trim(), amount, category, expense_date: expenseDate, notes: notes.trim() || null });
      if (!success) setSaveError(t(errorKey));
    } catch {
      setSaveError(t(errorKey));
    } finally {
      setSaving(false);
    }
    return null;
  }

  return {
    title, setTitle, amountText, setAmountText, category, setCategory, expenseDate, setExpenseDate, notes, setNotes,
    errors, saveError, saving, save,
    suggestion: {
      visible: suggestCategory && !category && !suggestionDismissed,
      state: suggestionState,
      use: (id: ExpenseCategory) => { setCategory(id); clearSuggestion(); },
      dismiss: () => { setSuggestionDismissed(true); clearSuggestion(); },
    },
  };
}
