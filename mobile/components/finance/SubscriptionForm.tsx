import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { SelectionField } from '@/components/profile/SelectionField';
import { ExpenseDatePicker } from '@/components/wallet/ExpenseDatePicker';
import { ExpenseTextField } from '@/components/wallet/ExpenseTextField';
import type { TranslationKey } from '@/constants/i18n';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { EXPENSE_CATEGORIES, isValidISODate, localDateISO, parseExpenseAmount } from '@/lib/expenseForm';
import type { ExpenseCategory } from '@/lib/expenseForm';
import { BILLING_FREQUENCIES, REMINDER_DAY_CHOICES, isReminderDays } from '@/lib/subscriptions';
import type { BillingFrequency, SubscriptionInput, SubscriptionRecord } from '@/lib/subscriptions';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type FieldErrors = Partial<Record<'name' | 'amount' | 'frequency' | 'date', string>>;
const NO_CATEGORY = 'none';

export function reminderDaysLabel(days: number, t: (key: TranslationKey, values?: Record<string, string | number>) => string) {
  return (REMINDER_DAY_CHOICES as readonly number[]).includes(days) ? t(`subscription.reminderDays.${days as (typeof REMINDER_DAY_CHOICES)[number]}`) : t('subscription.reminderDaysOther', { count: days });
}

export function SubscriptionForm({ initial, onSave }: { initial?: SubscriptionRecord; onSave: (input: SubscriptionInput) => Promise<boolean> }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [amountText, setAmountText] = useState(initial ? Number(initial.amount).toFixed(2) : '');
  const [category, setCategory] = useState<ExpenseCategory | null>(initial?.category ?? null);
  const [frequency, setFrequency] = useState<BillingFrequency | null>(initial?.billing_frequency ?? 'monthly');
  const [nextDate, setNextDate] = useState(initial?.next_billing_date ?? localDateISO());
  const [reminderDays, setReminderDays] = useState(initial && isReminderDays(initial.reminder_days_before) ? initial.reminder_days_before : 3);
  const [notificationsEnabled, setNotificationsEnabled] = useState(initial?.notifications_enabled ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const reminderChoices: number[] = [...REMINDER_DAY_CHOICES];
  if (!reminderChoices.includes(reminderDays)) reminderChoices.push(reminderDays);

  async function submit() {
    if (saving) return;
    const amount = parseExpenseAmount(amountText);
    const next: FieldErrors = {
      name: name.trim() ? undefined : t('subscription.nameRequired'),
      amount: !amountText.trim() ? t('subscription.amountRequired') : amount === null ? t('subscription.amountInvalid') : undefined,
      frequency: frequency ? undefined : t('subscription.frequencyRequired'),
      date: isValidISODate(nextDate) ? undefined : t('subscription.nextDateRequired'),
    };
    setErrors(next);
    setSaveError(false);
    if (Object.values(next).some(Boolean) || amount === null || !frequency) return;
    setSaving(true);
    try {
      const ok = await onSave({
        name: name.trim(), amount, category, billing_frequency: frequency, next_billing_date: nextDate,
        reminder_days_before: reminderDays, notifications_enabled: notificationsEnabled, is_active: initial?.is_active ?? true, notes: notes.trim() || null,
      });
      if (!ok) setSaveError(true);
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  return <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <ExpenseTextField label={t('subscription.name')} value={name} onChangeText={(value) => { setName(value); setErrors((current) => ({ ...current, name: undefined })); }} placeholder={t('subscription.namePlaceholder')} maxLength={120} error={errors.name} />
    <ExpenseTextField label={t('subscription.amount')} value={amountText} onChangeText={(value) => { setAmountText(value); setErrors((current) => ({ ...current, amount: undefined })); }} placeholder="0.00" prefix="RM" keyboardType="decimal-pad" error={errors.amount} />
    <SelectionField label={t('subscription.frequency')} labelOnCard value={frequency} placeholder={t('subscription.frequencyPlaceholder')} options={BILLING_FREQUENCIES.map((id) => ({ id, label: t(`subscription.frequency.${id}`) }))} onSelect={(id) => { setFrequency(id as BillingFrequency); setErrors((current) => ({ ...current, frequency: undefined })); }} error={errors.frequency} />
    <ExpenseDatePicker value={nextDate} onChange={(value) => { setNextDate(value); setErrors((current) => ({ ...current, date: undefined })); }} error={errors.date} label={t('subscription.nextDate')} pickerTitle={t('subscription.nextDatePicker')} />
    <SelectionField label={t('subscription.category')} labelOnCard value={category ?? NO_CATEGORY} placeholder={t('subscription.categoryNone')} options={[{ id: NO_CATEGORY, label: t('subscription.categoryNone') }, ...EXPENSE_CATEGORIES.map((id) => ({ id, label: t(`expense.category.${id}`) }))]} onSelect={(id) => setCategory(id === NO_CATEGORY ? null : id as ExpenseCategory)} />
    <SelectionField label={t('subscription.reminderTiming')} labelOnCard value={String(reminderDays)} placeholder={reminderDaysLabel(3, t)} options={reminderChoices.map((days) => ({ id: String(days), label: reminderDaysLabel(days, t) }))} onSelect={(id) => setReminderDays(Number(id))} />
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={[styles.toggleLabel, { color: tokens.cardText }]}>{t('subscription.notifications')}</Text>
        <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('subscription.notificationsHint')}</Text>
      </View>
      <Switch testID="subscription-notifications" accessibilityLabel={t('subscription.notifications')} value={notificationsEnabled} onValueChange={setNotificationsEnabled}
        trackColor={{ false: tokens.cardElevated, true: tokens.brandBlue }} thumbColor={colors.white} ios_backgroundColor={tokens.cardElevated} />
    </View>
    <ExpenseTextField label={t('subscription.notes')} value={notes} onChangeText={setNotes} placeholder={t('subscription.notesPlaceholder')} multiline maxLength={1000} />
    {saveError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t('subscription.saveError')}</Text>}
    {saving && <Text style={[styles.saving, { color: tokens.cardMutedText }]} accessibilityLiveRegion="polite">{t('subscription.saving')}</Text>}
    <PrimaryButton onPress={() => { void submit(); }} loading={saving}>{initial ? t('subscription.saveChanges') : t('subscription.save')}</PrimaryButton>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space5 },
  toggleRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space3 }, toggleCopy: { flex: 1, gap: spacing.space1 },
  toggleLabel: { ...typography.label }, hint: { ...typography.label, lineHeight: 19 },
  error: { ...typography.label, lineHeight: 20 }, saving: { ...typography.label, textAlign: 'center' },
});
