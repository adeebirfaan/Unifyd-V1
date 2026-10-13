import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SubscriptionSavedOverlay } from '@/components/finance/SubscriptionSavedOverlay';
import type { OverlayPhase, SavedSummary } from '@/components/finance/SubscriptionSavedOverlay';
import { NO_CATEGORY, reminderDaysLabel, validateSubscription } from '@/components/finance/SubscriptionForm';
import type { SubscriptionFieldErrors } from '@/components/finance/SubscriptionForm';
import { SubscriptionNameField } from '@/components/finance/SubscriptionNameField';
import { SwipeToSave } from '@/components/finance/SwipeToSave';
import type { SwipeOrigin } from '@/components/finance/SwipeToSave';
import { SelectionField } from '@/components/profile/SelectionField';
import { ExpenseDatePicker } from '@/components/wallet/ExpenseDatePicker';
import { ExpenseTextField } from '@/components/wallet/ExpenseTextField';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { EXPENSE_CATEGORIES, localDateISO } from '@/lib/expenseForm';
import type { ExpenseCategory } from '@/lib/expenseForm';
import { formatRinggit } from '@/lib/expenseHistory';
import { canRetryReminder } from '@/lib/subscriptionCreate';
import type { CreateResult } from '@/lib/subscriptionCreate';
import { REMINDER_ISSUE_TEXT } from '@/lib/subscriptionReminders';
import type { SubscriptionReminderIssue } from '@/lib/subscriptionReminders';
import { BILLING_FREQUENCIES, REMINDER_DAY_CHOICES } from '@/lib/subscriptions';
import type { BillingFrequency, SubscriptionInput } from '@/lib/subscriptions';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Section = 'identity' | 'amount' | 'billing';
type Overlay = { phase: OverlayPhase; origin: SwipeOrigin | null } | null;

/**
 * The Add Subscription screen (2026-10-13 redesign). Edit keeps `SubscriptionForm`; both share its validation.
 * Sections: identity (name with suggestions and icon), amount, billing (frequency and next date), reminder,
 * and optional details. Saving is a swipe (or the tap-to-save button), which validates first; only a valid
 * form opens the blue overlay. The overlay shows the checkmark only after `onCreate` confirms the row was
 * saved. A failed save closes it and keeps every value. The save footer hides while the keyboard is open. A saved row is never inserted again from this screen:
 * a failed reminder is retried on its own.
 */
export function AddSubscriptionForm({ onBack, onCreate, onRetryReminder, onContinue }: {
  onBack: () => void;
  onCreate: (input: SubscriptionInput) => Promise<CreateResult>;
  onRetryReminder: (input: SubscriptionInput) => Promise<SubscriptionReminderIssue>;
  onContinue: (issue: SubscriptionReminderIssue) => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const keyboardVisible = useKeyboardVisible();
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [frequency, setFrequency] = useState<BillingFrequency | null>('monthly');
  const [nextDate, setNextDate] = useState(localDateISO());
  const [reminderDays, setReminderDays] = useState(3);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<SubscriptionFieldErrors>({});
  const [saveError, setSaveError] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [saved, setSaved] = useState<{ input: SubscriptionInput; issue: SubscriptionReminderIssue } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const amountInput = useRef<TextInput>(null);
  const sectionY = useRef<Partial<Record<Section, number>>>({});
  // Set from a valid submit until it fails; never cleared after a confirmed save. Blocks duplicate inserts.
  const submitting = useRef(false);
  const busy = overlay !== null;

  const clear = (field: keyof SubscriptionFieldErrors) => setErrors((current) => ({ ...current, [field]: undefined }));

  function submit(origin: SwipeOrigin | null) {
    if (submitting.current) return;
    const { errors: next, input } = validateSubscription({ name, amountText, category, frequency, nextDate, reminderDays, notificationsEnabled, isActive: true, notes }, t);
    setErrors(next);
    setSaveError(false);
    if (!input) {
      // The slider springs back, and the first invalid section scrolls into view.
      setResetKey((key) => key + 1);
      const first: Section = next.name ? 'identity' : next.amount ? 'amount' : 'billing';
      scroll.current?.scrollTo({ y: Math.max(0, (sectionY.current[first] ?? 0) - spacing.space4), animated: !reduceMotion });
      AccessibilityInfo.announceForAccessibility(t('subscription.fixErrors'));
      return;
    }
    submitting.current = true;
    Keyboard.dismiss();
    setOverlay({ phase: 'saving', origin });
    void (async () => {
      const result = await onCreate(input).catch((): CreateResult => ({ saved: false }));
      if (result.saved) {
        setSaved({ input, issue: result.reminderIssue });
        setOverlay((current) => current && { ...current, phase: 'success' });
      } else {
        submitting.current = false;
        setOverlay((current) => current && { ...current, phase: 'failed' });
      }
    })();
  }

  // After a failed save the overlay has shrunk away: the form is back, unchanged, with the slider reset.
  const restoreForm = useCallback(() => {
    setOverlay(null);
    setSaveError(true);
    setResetKey((key) => key + 1);
  }, []);

  async function retryReminder() {
    if (!saved || retrying) return;
    setRetrying(true);
    const issue = await onRetryReminder(saved.input).catch((): SubscriptionReminderIssue => 'error');
    setSaved({ ...saved, issue });
    setRetrying(false);
  }

  const summary: SavedSummary | null = saved && {
    name: saved.input.name,
    amount: formatRinggit(saved.input.amount),
    frequency: t(`subscription.frequency.${saved.input.billing_frequency}`),
    // Only a reminder that was wanted but could not be set is mentioned on the success screen.
    reminder: saved.input.notifications_enabled && saved.issue
      ? { text: t(`subscription.reminderShort.${saved.issue}`), label: t(REMINDER_ISSUE_TEXT[saved.issue]), issue: true, canRetry: canRetryReminder(saved.issue) }
      : { text: '', label: '', issue: false, canRetry: false },
  };

  const card = [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];
  const divider = <View style={[styles.divider, { backgroundColor: tokens.border }]} />;

  return <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={scroll} style={styles.fill} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space2 }]} keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: tokens.screenText }]} numberOfLines={1}>{t('subscription.add')}</Text>
      </View>
      <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('subscription.addIntro')}</Text>

      <View onLayout={(event) => { sectionY.current.identity = event.nativeEvent.layout.y; }} style={card}>
        <SubscriptionNameField value={name} onChangeText={(value) => { setName(value); clear('name'); }} error={errors.name} />
      </View>

      <View onLayout={(event) => { sectionY.current.amount = event.nativeEvent.layout.y; }} style={card}>
        <Text style={[styles.fieldLabel, { color: tokens.cardText }]}>{t('subscription.amount')}</Text>
        <Pressable accessible={false} onPress={() => amountInput.current?.focus()} style={[styles.amountControl, { backgroundColor: tokens.cardElevated, borderColor: errors.amount ? tokens.cardErrorText : tokens.border }]}>
          <Text style={[styles.amountPrefix, { color: tokens.cardMutedText }]}>RM</Text>
          <TextInput ref={amountInput} value={amountText} onChangeText={(value) => { setAmountText(value); clear('amount'); }} placeholder="0.00" placeholderTextColor={tokens.cardMutedText}
            keyboardType="decimal-pad" selectionColor={tokens.brandCyan} accessibilityLabel={t('subscription.amount')} style={[styles.amountInput, { color: tokens.cardText }]} />
        </Pressable>
        {errors.amount && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{errors.amount}</Text>}
      </View>

      <View onLayout={(event) => { sectionY.current.billing = event.nativeEvent.layout.y; }} style={card}>
        <SectionTitle icon="repeat-outline">{t('subscription.sectionBilling')}</SectionTitle>
        <Text style={[styles.fieldLabel, { color: tokens.cardText }]}>{t('subscription.frequency')}</Text>
        <View role="radiogroup" accessibilityLabel={t('subscription.frequency')} style={styles.chips}>
          {BILLING_FREQUENCIES.map((id) => {
            const selected = frequency === id;
            return <Pressable key={id} accessibilityRole="radio" aria-checked={selected} onPress={() => { setFrequency(id); clear('frequency'); }}
              style={[styles.chip, { backgroundColor: tokens.cardElevated, borderColor: selected ? tokens.brandCyan : tokens.border }]}>
              {selected && <Ionicons name="checkmark" size={16} color={tokens.brandCyan} />}
              <Text style={[styles.chipText, { color: selected ? tokens.brandCyan : tokens.cardText }]}>{t(`subscription.frequency.${id}`)}</Text>
            </Pressable>;
          })}
        </View>
        {errors.frequency && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{errors.frequency}</Text>}
        {divider}
        <ExpenseDatePicker variant="row" value={nextDate} onChange={(value) => { setNextDate(value); clear('date'); }} error={errors.date} label={t('subscription.nextDate')} pickerTitle={t('subscription.nextDatePicker')} />
      </View>

      <View style={card}>
        <SectionTitle icon="notifications-outline">{t('subscription.sectionReminder')}</SectionTitle>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={[styles.toggleLabel, { color: tokens.cardText }]}>{t('subscription.notifications')}</Text>
            <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('subscription.notificationsHint')}</Text>
          </View>
          <Switch testID="subscription-notifications" accessibilityLabel={t('subscription.notifications')} value={notificationsEnabled} onValueChange={setNotificationsEnabled}
            trackColor={{ false: tokens.cardElevated, true: tokens.brandBlue }} thumbColor={colors.white} ios_backgroundColor={tokens.cardElevated} />
        </View>
        {divider}
        <SelectionField variant="row" label={t('subscription.reminderTiming')} labelOnCard value={String(reminderDays)} placeholder={reminderDaysLabel(3, t)} options={REMINDER_DAY_CHOICES.map((days) => ({ id: String(days), label: reminderDaysLabel(days, t) }))} onSelect={(id) => setReminderDays(Number(id))} />
      </View>

      <View style={[card, styles.quietCard]}>
        <SectionTitle icon="ellipsis-horizontal-circle-outline" quiet>{t('subscription.sectionOptional')}</SectionTitle>
        <SelectionField variant="row" label={t('subscription.category')} labelOnCard value={category ?? NO_CATEGORY} placeholder={t('subscription.categoryNone')} options={[{ id: NO_CATEGORY, label: t('subscription.categoryNone') }, ...EXPENSE_CATEGORIES.map((id) => ({ id, label: t(`expense.category.${id}`) }))]} onSelect={(id) => setCategory(id === NO_CATEGORY ? null : id as ExpenseCategory)} />
        {divider}
        <ExpenseTextField label={t('subscription.notes')} value={notes} onChangeText={setNotes} placeholder={t('subscription.notesPlaceholder')} multiline maxLength={1000} />
      </View>
    </ScrollView>

    {/* The save footer stays behind the keyboard (hidden while it is open) instead of riding up over the fields.
        Scrolling dismisses the keyboard, so the footer is back as the student scrolls down to save. */}
    <View testID="subscription-save-footer" style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.space3) + spacing.space2, backgroundColor: tokens.screenBackground }, keyboardVisible && !busy && styles.hidden]}>
      {saveError && <Text testID="subscription-save-error" style={[styles.saveError, { color: tokens.errorText }]} accessibilityRole="alert">{t('subscription.saveError')}</Text>}
      <SwipeToSave testID="subscription-swipe" label={t('subscription.slideToSave')} disabled={busy} resetKey={resetKey} onComplete={submit} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('subscription.tapToSaveLabel')} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => submit(null)} style={styles.tapSave}>
        <Text style={[styles.tapSaveText, { color: tokens.pageAccent }]}>{t('subscription.tapToSave')}</Text>
      </Pressable>
    </View>

    {overlay && <SubscriptionSavedOverlay phase={overlay.phase} origin={overlay.origin} summary={summary} retrying={retrying} reduceMotion={reduceMotion}
      onContinue={() => onContinue(saved?.issue ?? '')} onRetryReminder={() => { void retryReminder(); }} onHidden={restoreForm} />}
  </KeyboardAvoidingView>;
}

function SectionTitle({ icon, quiet = false, children }: { icon: IconName; quiet?: boolean; children: ReactNode }) {
  const { tokens } = useAppearance();
  return <View style={styles.sectionTitle}>
    <Ionicons name={icon} size={16} color={quiet ? tokens.cardMutedText : tokens.brandCyan} />
    <Text accessibilityRole="header" style={[styles.sectionText, { color: tokens.cardMutedText }]}>{children}</Text>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.space6, paddingBottom: spacing.space6, gap: spacing.space3, width: '100%', maxWidth: 568, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.space1, marginLeft: -spacing.space2 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.screenTitle, flex: 1 },
  helper: { ...typography.body, lineHeight: 22, marginBottom: spacing.space2 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space4, gap: spacing.space3 },
  quietCard: { paddingVertical: spacing.space3 },
  divider: { height: StyleSheet.hairlineWidth },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  sectionText: { ...typography.label },
  fieldLabel: { ...typography.label },
  amountControl: { minHeight: 64, borderRadius: radius.radiusMd, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.space4, gap: spacing.space2 },
  amountPrefix: { ...typography.sectionTitle },
  amountInput: { ...typography.numeric, flex: 1, minHeight: 60, paddingVertical: spacing.space2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2 },
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space1, borderWidth: 1, borderRadius: radius.radiusFull, paddingHorizontal: spacing.space4 },
  chipText: { ...typography.label, fontSize: 14 },
  toggleRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space3 }, toggleCopy: { flex: 1, gap: spacing.space1 },
  toggleLabel: { ...typography.body }, hint: { ...typography.label, fontWeight: '500', lineHeight: 18 },
  error: { ...typography.label },
  hidden: { display: 'none' },
  footer: { paddingHorizontal: spacing.space6, paddingTop: spacing.space3, gap: spacing.space1, width: '100%', maxWidth: 568, alignSelf: 'center' },
  saveError: { ...typography.label, lineHeight: 19, textAlign: 'center', marginBottom: spacing.space1 },
  tapSave: { minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingHorizontal: spacing.space4 },
  tapSaveText: { ...typography.label, fontSize: 14 },
});
