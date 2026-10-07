import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { SelectionField } from '@/components/profile/SelectionField';
import { ExpenseDatePicker } from '@/components/wallet/ExpenseDatePicker';
import { ExpenseTextField } from '@/components/wallet/ExpenseTextField';
import type { TranslationKey } from '@/constants/i18n';
import { radius, spacing, typography } from '@/constants/theme';
import { EXPENSE_CATEGORIES, isValidISODate, localDateISO, parseExpenseAmount } from '@/lib/expenseForm';
import type { ExpenseCategory, ExpenseInput } from '@/lib/expenseForm';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type FieldErrors = Partial<Record<'title' | 'amount' | 'category' | 'date', string>>;
export type ExpenseFormInitial = { title: string; amount: string; category: ExpenseCategory | null; expenseDate: string; notes: string };

export function ExpenseForm({ initial, onSave, submitKey, savingKey, errorKey }: {
  initial?: ExpenseFormInitial;
  onSave: (input: ExpenseInput) => Promise<boolean>;
  submitKey: TranslationKey;
  savingKey: TranslationKey;
  errorKey: TranslationKey;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amountText, setAmountText] = useState(initial?.amount ?? '');
  const [category, setCategory] = useState<ExpenseCategory | null>(initial?.category ?? null);
  const [expenseDate, setExpenseDate] = useState(initial?.expenseDate ?? localDateISO());
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const categoryOptions = EXPENSE_CATEGORIES.map((id) => ({ id, label: t(`expense.category.${id}`) }));

  async function save() {
    if (saving) return;
    const amount = parseExpenseAmount(amountText);
    const nextErrors: FieldErrors = {
      title: title.trim() ? undefined : t('expense.titleRequired'),
      amount: !amountText.trim() ? t('expense.amountRequired') : amount === null ? t('expense.amountInvalid') : undefined,
      category: category ? undefined : t('expense.categoryRequired'),
      date: isValidISODate(expenseDate) ? undefined : t('expense.dateRequired'),
    };
    setErrors(nextErrors);
    setSaveError(null);
    if (Object.values(nextErrors).some(Boolean) || amount === null || !category) return;

    setSaving(true);
    try {
      const success = await onSave({ title: title.trim(), amount, category, expense_date: expenseDate, notes: notes.trim() || null });
      if (!success) setSaveError(t(errorKey));
    } catch {
      setSaveError(t(errorKey));
    } finally {
      setSaving(false);
    }
  }

  return <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <ExpenseTextField label={t('expense.title')} value={title} onChangeText={(value) => { setTitle(value); setErrors((current) => ({ ...current, title: undefined })); }} placeholder={t('expense.titlePlaceholder')} maxLength={120} error={errors.title} />
    <ExpenseTextField label={t('expense.amount')} value={amountText} onChangeText={(value) => { setAmountText(value); setErrors((current) => ({ ...current, amount: undefined })); }} placeholder="0.00" prefix="RM" keyboardType="decimal-pad" error={errors.amount} />
    <SelectionField label={t('expense.category')} labelOnCard value={category} placeholder={t('expense.categoryPlaceholder')} options={categoryOptions} onSelect={(id) => { setCategory(id as ExpenseCategory); setErrors((current) => ({ ...current, category: undefined })); }} error={errors.category} />
    <ExpenseDatePicker value={expenseDate} onChange={(value) => { setExpenseDate(value); setErrors((current) => ({ ...current, date: undefined })); }} error={errors.date} />
    <ExpenseTextField label={t('expense.notes')} value={notes} onChangeText={setNotes} placeholder={t('expense.notesPlaceholder')} multiline maxLength={1000} />
    {saveError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{saveError}</Text>}
    {saving && <Text style={[styles.saving, { color: tokens.cardMutedText }]} accessibilityLiveRegion="polite">{t(savingKey)}</Text>}
    <PrimaryButton onPress={() => { void save(); }} loading={saving}>{t(submitKey)}</PrimaryButton>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space5 },
  error: { ...typography.label, lineHeight: 20 }, saving: { ...typography.label, textAlign: 'center' },
});
