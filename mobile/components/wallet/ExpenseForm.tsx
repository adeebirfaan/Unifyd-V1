import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { SelectionField } from '@/components/profile/SelectionField';
import { CategorySuggestion } from '@/components/wallet/CategorySuggestion';
import { ExpenseDatePicker } from '@/components/wallet/ExpenseDatePicker';
import { ExpenseTextField } from '@/components/wallet/ExpenseTextField';
import type { TranslationKey } from '@/constants/i18n';
import { radius, spacing, typography } from '@/constants/theme';
import { useExpenseDraft } from '@/hooks/useExpenseDraft';
import type { ExpenseDraftInitial } from '@/hooks/useExpenseDraft';
import { EXPENSE_CATEGORIES } from '@/lib/expenseForm';
import type { ExpenseCategory, ExpenseInput } from '@/lib/expenseForm';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export type ExpenseFormInitial = ExpenseDraftInitial;

export function ExpenseForm({ initial, onSave, submitKey, savingKey, errorKey, suggestCategory = false }: {
  initial?: ExpenseFormInitial;
  /** Offer an optional category suggestion from the student's own past expenses (never applied automatically). */
  suggestCategory?: boolean;
  onSave: (input: ExpenseInput) => Promise<boolean>;
  submitKey: TranslationKey;
  savingKey: TranslationKey;
  errorKey: TranslationKey;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const draft = useExpenseDraft({ initial, onSave, errorKey, suggestCategory });
  const { errors } = draft;
  const categoryOptions = EXPENSE_CATEGORIES.map((id) => ({ id, label: t(`expense.category.${id}`) }));

  return <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <ExpenseTextField label={t('expense.title')} value={draft.title} onChangeText={draft.setTitle} placeholder={t('expense.titlePlaceholder')} maxLength={120} error={errors.title} />
    <ExpenseTextField label={t('expense.amount')} value={draft.amountText} onChangeText={draft.setAmountText} placeholder="0.00" prefix="RM" keyboardType="decimal-pad" error={errors.amount} />
    {draft.suggestion.visible && <CategorySuggestion state={draft.suggestion.state} onUse={draft.suggestion.use} onDismiss={draft.suggestion.dismiss} />}
    <SelectionField label={t('expense.category')} labelOnCard value={draft.category} placeholder={t('expense.categoryPlaceholder')} options={categoryOptions} onSelect={(id) => draft.setCategory(id as ExpenseCategory)} error={errors.category} />
    <ExpenseDatePicker value={draft.expenseDate} onChange={draft.setExpenseDate} error={errors.date} />
    <ExpenseTextField label={t('expense.notes')} value={draft.notes} onChangeText={draft.setNotes} placeholder={t('expense.notesPlaceholder')} multiline maxLength={1000} />
    {draft.saveError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{draft.saveError}</Text>}
    {draft.saving && <Text style={[styles.saving, { color: tokens.cardMutedText }]} accessibilityLiveRegion="polite">{t(savingKey)}</Text>}
    <PrimaryButton onPress={() => { void draft.save(); }} loading={draft.saving}>{t(submitKey)}</PrimaryButton>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space5 },
  error: { ...typography.label, lineHeight: 20 }, saving: { ...typography.label, textAlign: 'center' },
});
