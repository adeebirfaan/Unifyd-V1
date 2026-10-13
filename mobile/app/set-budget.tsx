import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FinanceNumber, financeFontStyle } from '@/components/FinanceNumber';
import { SaveSuccessOverlay } from '@/components/finance/SaveSuccessOverlay';
import type { OverlayPhase } from '@/components/finance/SaveSuccessOverlay';
import { SwipeToSave } from '@/components/finance/SwipeToSave';
import type { SwipeOrigin } from '@/components/finance/SwipeToSave';
import { radius, spacing, typography } from '@/constants/theme';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { currentBudgetPeriod } from '@/lib/budgetPeriod';
import type { BudgetPeriodType, BudgetRecord } from '@/lib/budgetPeriod';
import { parseExpenseAmount } from '@/lib/expenseForm';
import { formatExpenseDate, formatRinggit } from '@/lib/expenseHistory';
import { supabase } from '@/lib/supabase';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error';
type Overlay = { phase: OverlayPhase; origin: SwipeOrigin | null } | null;
type Saved = { amount: number; period: BudgetPeriodType; range: string; updated: boolean };
const PERIODS: readonly BudgetPeriodType[] = ['weekly', 'monthly'];

/**
 * Set or manage the current weekly or monthly budget (2026-10-13 redesign, matching Add subscription).
 * Sections: a Weekly/Monthly segmented control with the read-only current period, then a large amount field.
 * Saving is the shared slide-to-save (or "Or tap to save"), which validates first. The shared blue overlay shows
 * loading while the existing insert or update runs, and success only after it is confirmed. A failure shrinks it
 * away, keeps the amount, and resets the slider. Queries, period rules, and create-versus-update are unchanged:
 * an existing budget for the shown period is updated, never duplicated.
 */
export default function SetBudgetScreen() {
  const { period: routePeriod } = useLocalSearchParams<{ period?: string }>();
  const [period, setPeriod] = useState<BudgetPeriodType>(routePeriod === 'weekly' ? 'weekly' : 'monthly');
  const [record, setRecord] = useState<BudgetRecord | null>(null);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [loading, setLoading] = useState<LoadState>('loading');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const requestVersion = useRef(0);
  // Set from a valid submit until it fails; never cleared after a confirmed save. Blocks duplicate saves.
  const submitting = useRef(false);
  const amountInput = useRef<TextInput>(null);
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { t, language } = useI18n();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const keyboardVisible = useKeyboardVisible();
  const navigation = useNavigation();
  const userId = session?.user.id;
  const dates = currentBudgetPeriod(period);
  const busy = overlay !== null;

  // As on Add subscription: the iOS 26 full-screen back swipe would take the slider's drag. The edge swipe stays.
  useLayoutEffect(() => { navigation.setOptions({ fullScreenGestureEnabled: false }); }, [navigation]);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading('loading');
    setRecord(null);
    setAmount('');
    setAmountError(null);
    setSaveError(false);
    if (!userId) { setLoading('error'); return; }
    const current = currentBudgetPeriod(period);
    try {
      const { data, error } = await supabase.from('budgets')
        .select('id,amount,period_type,period_start')
        .eq('user_id', userId)
        .eq('period_type', period)
        .eq('period_start', current.start)
        .maybeSingle();
      if (version !== requestVersion.current) return;
      if (error) throw error;
      const budget = data as BudgetRecord | null;
      setRecord(budget);
      setAmount(budget ? Number(budget.amount).toFixed(2) : '');
      setLoading('ready');
    } catch {
      if (version === requestVersion.current) setLoading('error');
    }
  }, [period, userId]);

  useEffect(() => {
    let active = true;
    const versionRef = requestVersion;
    void Promise.resolve().then(() => { if (active) return load(); });
    return () => { active = false; ++versionRef.current; };
  }, [load]);

  /** The existing create-or-update for the shown period. Resolves true only once the row is confirmed. */
  async function persist(parsed: number): Promise<boolean> {
    if (!userId) return false;
    const current = currentBudgetPeriod(period);
    try {
      if (record) {
        const { data, error } = await supabase.from('budgets')
          .update({ amount: parsed })
          .eq('id', record.id)
          .eq('user_id', userId)
          .eq('period_type', period)
          .eq('period_start', current.start)
          .select('id')
          .maybeSingle();
        return !error && !!data;
      }
      const { data, error } = await supabase.from('budgets')
        .insert({ user_id: userId, amount: parsed, period_type: period, period_start: current.start })
        .select('id')
        .maybeSingle();
      return !error && !!data;
    } catch { return false; }
  }

  function submit(origin: SwipeOrigin | null) {
    if (submitting.current || loading !== 'ready' || !userId) { setResetKey((key) => key + 1); return; }
    const parsed = parseExpenseAmount(amount);
    setSaveError(false);
    if (parsed === null) {
      const message = t(amount.trim() ? 'budget.amountInvalid' : 'budget.amountRequired');
      setAmountError(message);
      setResetKey((key) => key + 1);
      amountInput.current?.focus();
      AccessibilityInfo.announceForAccessibility(message);
      return;
    }
    submitting.current = true;
    Keyboard.dismiss();
    const result: Saved = { amount: parsed, period, range: periodRange, updated: !!record };
    setOverlay({ phase: 'saving', origin });
    void persist(parsed).then((ok) => {
      if (ok) { setSaved(result); setOverlay((current) => current && { ...current, phase: 'success' }); }
      else { submitting.current = false; setOverlay((current) => current && { ...current, phase: 'failed' }); }
    });
  }

  // After a failed save the overlay has shrunk away: the form is back, unchanged, with the slider reset.
  const restoreForm = useCallback(() => {
    setOverlay(null);
    setSaveError(true);
    setResetKey((key) => key + 1);
  }, []);

  const periodRange = `${formatExpenseDate(dates.start, language)} – ${formatExpenseDate(dates.end, language)}`;
  const successTitle = saved?.updated ? t('budget.updatedTitle') : t('budget.savedTitle');
  const successPeriod = saved ? t(saved.period === 'weekly' ? 'budget.weeklyBudget' : 'budget.monthlyBudget') : '';
  const card = [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];

  return <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.fill} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space2 }]} keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('wallet.eyebrow')}</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: tokens.screenText }]}>{t(record ? 'budget.manage' : 'budget.set')}</Text>

      {/* Period: a two-way segmented choice, with the read-only date range it covers. */}
      <View style={card}>
        <Text style={[styles.fieldLabel, { color: tokens.cardText }]}>{t('budget.period')}</Text>
        <View role="radiogroup" accessibilityLabel={t('budget.period')} style={[styles.segments, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
          {PERIODS.map((choice) => {
            const selected = period === choice;
            return <Pressable key={choice} testID={`budget-period-${choice}`} accessibilityRole="radio" aria-checked={selected} disabled={busy}
              onPress={() => { if (!selected && !busy) setPeriod(choice); }}
              style={[styles.segment, selected && { backgroundColor: tokens.cardBackground, borderColor: tokens.brandCyan }]}>
              {selected && <Ionicons name="checkmark" size={16} color={tokens.brandCyan} />}
              <Text style={[styles.segmentText, { color: selected ? tokens.brandCyan : tokens.cardMutedText }]}>{t(`budget.${choice}`)}</Text>
            </Pressable>;
          })}
        </View>
        <View testID="budget-current-period" accessible accessibilityLabel={`${t('budget.currentPeriod')}: ${periodRange}`} style={[styles.periodInfo, { backgroundColor: tokens.cardElevated }]}>
          <Ionicons name="calendar-outline" size={18} color={tokens.brandCyan} />
          <View style={styles.periodCopy}>
            <Text style={[styles.periodLabel, { color: tokens.cardMutedText }]}>{t('budget.currentPeriod')}</Text>
            <Text style={[styles.periodRange, { color: tokens.cardText }]}>{periodRange}</Text>
          </View>
        </View>
      </View>

      {/* Amount: the focal field, in the finance font used by Wallet's other amounts (owner request). */}
      <View style={card}>
        {loading === 'loading' ? <View style={styles.status}><ActivityIndicator color={tokens.brandCyan} /><Text style={{ color: tokens.cardMutedText }}>{t('budget.loading')}</Text></View>
          : loading === 'error' ? <View style={styles.status}><Text style={{ color: tokens.cardErrorText }} accessibilityRole="alert">{t('budget.loadError')}</Text><Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.retry}><Text style={{ color: tokens.brandCyan }}>{t('wallet.retry')}</Text></Pressable></View>
            : <>
              <Text style={[styles.fieldLabel, { color: tokens.cardText }]}>{t('budget.amount')}</Text>
              <Pressable accessible={false} onPress={() => amountInput.current?.focus()} style={[styles.amountControl, { backgroundColor: tokens.cardElevated, borderColor: amountError ? tokens.cardErrorText : tokens.border }]}>
                <FinanceNumber style={[styles.amountPrefix, { color: tokens.cardMutedText }]}>RM</FinanceNumber>
                <View style={[styles.amountRule, { backgroundColor: tokens.border }]} />
                <TextInput ref={amountInput} value={amount} onChangeText={(value) => { setAmount(value); setAmountError(null); setSaveError(false); }} editable={!busy}
                  placeholder={t('budget.amountPlaceholder')} placeholderTextColor={tokens.cardMutedText} keyboardType="decimal-pad" selectionColor={tokens.brandCyan}
                  accessibilityLabel={t('budget.amount')} style={[styles.amountInput, financeFontStyle, { color: tokens.cardText }]} />
              </Pressable>
              {amountError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{amountError}</Text>}
              {/* An existing budget for this period is updated in place, never duplicated. */}
              {record && <View testID="budget-updating" style={styles.updating}>
                <Ionicons name="create-outline" size={15} color={tokens.cardMutedText} />
                <Text style={[styles.updatingText, { color: tokens.cardMutedText }]}>{t('budget.updatingExisting', { amount: formatRinggit(Number(record.amount)) })}</Text>
              </View>}
            </>}
      </View>
    </ScrollView>

    {/* The same save footer as Add subscription; hidden while the keyboard is open, back after scrolling dismisses it. */}
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.space3) + spacing.space2, backgroundColor: tokens.screenBackground }, keyboardVisible && !busy && styles.hidden]}>
      {saveError && <Text testID="budget-save-error" style={[styles.saveError, { color: tokens.errorText }]} accessibilityRole="alert">{t('budget.saveError')}</Text>}
      <SwipeToSave testID="budget-swipe" label={t('budget.slideToSave')} disabled={busy || loading !== 'ready'} resetKey={resetKey} onComplete={submit} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('budget.tapToSaveLabel')} accessibilityState={{ disabled: busy || loading !== 'ready' }} disabled={busy || loading !== 'ready'} onPress={() => submit(null)} style={styles.tapSave}>
        <Text style={[styles.tapSaveText, { color: tokens.pageAccent }]}>{t('budget.tapToSave')}</Text>
      </Pressable>
    </View>

    {overlay && <SaveSuccessOverlay testIDPrefix="budget" phase={overlay.phase === 'success' && !saved ? 'saving' : overlay.phase} origin={overlay.origin} reduceMotion={reduceMotion}
      savingLabel={t('budget.saving')} title={successTitle} amount={saved ? formatRinggit(saved.amount) : ''} continueLabel={t('budget.tapToContinue')}
      announcement={saved ? t('budget.savedA11y', { title: successTitle, amount: formatRinggit(saved.amount), period: successPeriod, range: saved.range }) : successTitle}
      onHidden={restoreForm}
      onContinue={() => router.replace({ pathname: '/(tabs)/wallet', params: { budgetPeriod: saved?.period ?? period, budgetSaved: '1' } })}
      details={(ink) => saved && <>
        <Text style={[styles.successPeriod, { color: ink }]}>{successPeriod}</Text>
        <Text style={[styles.successRange, { color: ink }]}>{saved.range}</Text>
      </>} />}
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.space6, paddingBottom: spacing.space6, gap: spacing.space3, width: '100%', maxWidth: 568, alignSelf: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -spacing.space2, marginBottom: spacing.space2 },
  eyebrow: { ...typography.label, letterSpacing: 2 },
  title: { ...typography.screenTitle, marginBottom: spacing.space3 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space4, gap: spacing.space3 },
  fieldLabel: { ...typography.label },
  segments: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.radiusFull, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space1, borderRadius: radius.radiusFull, borderWidth: 1, borderColor: 'transparent' },
  segmentText: { ...typography.body, fontWeight: '600' },
  periodInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3, borderRadius: radius.radiusMd, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3 },
  periodCopy: { flex: 1, gap: 2 },
  periodLabel: { ...typography.label, letterSpacing: 1.5, fontSize: 12 }, periodRange: { ...typography.body, fontWeight: '600' },
  amountControl: { minHeight: 68, borderRadius: radius.radiusMd, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.space4, gap: spacing.space3 },
  amountPrefix: { ...typography.sectionTitle },
  amountRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: spacing.space4 },
  amountInput: { ...typography.numeric, flex: 1, minWidth: 0, minHeight: 64, paddingVertical: spacing.space2 },
  updating: { flexDirection: 'row', alignItems: 'center', gap: spacing.space1 },
  updatingText: { ...typography.label, fontWeight: '500', flexShrink: 1 },
  status: { gap: spacing.space3, alignItems: 'flex-start' }, retry: { minHeight: 44, justifyContent: 'center' },
  error: { ...typography.label },
  hidden: { display: 'none' },
  footer: { paddingHorizontal: spacing.space6, paddingTop: spacing.space3, gap: spacing.space1, width: '100%', maxWidth: 568, alignSelf: 'center' },
  saveError: { ...typography.label, lineHeight: 19, textAlign: 'center', marginBottom: spacing.space1 },
  tapSave: { minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingHorizontal: spacing.space4 },
  tapSaveText: { ...typography.label, fontSize: 14 },
  successPeriod: { ...typography.body, fontWeight: '600' },
  successRange: { ...typography.label, fontWeight: '500' },
});
