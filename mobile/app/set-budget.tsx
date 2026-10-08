import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { SelectionField } from '@/components/profile/SelectionField';
import { ExpenseTextField } from '@/components/wallet/ExpenseTextField';
import { radius, spacing, typography } from '@/constants/theme';
import { currentBudgetPeriod } from '@/lib/budgetPeriod';
import type { BudgetPeriodType, BudgetRecord } from '@/lib/budgetPeriod';
import { parseExpenseAmount } from '@/lib/expenseForm';
import { formatExpenseDate } from '@/lib/expenseHistory';
import { supabase } from '@/lib/supabase';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error';

export default function SetBudgetScreen() {
  const { period: routePeriod } = useLocalSearchParams<{ period?: string }>();
  const [period, setPeriod] = useState<BudgetPeriodType>(routePeriod === 'weekly' ? 'weekly' : 'monthly');
  const [record, setRecord] = useState<BudgetRecord | null>(null);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [loading, setLoading] = useState<LoadState>('loading');
  const [saving, setSaving] = useState(false);
  const requestVersion = useRef(0);
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { t, language } = useI18n();
  const insets = useSafeAreaInsets();
  const userId = session?.user.id;
  const dates = currentBudgetPeriod(period);

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

  async function save() {
    if (saving || loading !== 'ready' || !userId) return;
    const parsed = parseExpenseAmount(amount);
    if (parsed === null) {
      setAmountError(t(amount.trim() ? 'budget.amountInvalid' : 'budget.amountRequired'));
      return;
    }
    setSaving(true);
    setSaveError(false);
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
        if (error || !data) throw error ?? new Error('Budget unavailable');
      } else {
        const { data, error } = await supabase.from('budgets')
          .insert({ user_id: userId, amount: parsed, period_type: period, period_start: current.start })
          .select('id')
          .maybeSingle();
        if (error || !data) throw error ?? new Error('Budget unavailable');
      }
      router.replace({ pathname: '/(tabs)/wallet', params: { budgetPeriod: period, budgetSaved: '1' } });
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  const options = [{ id: 'weekly', label: t('budget.weekly') }, { id: 'monthly', label: t('budget.monthly') }];
  const periodRange = `${formatExpenseDate(dates.start, language)} – ${formatExpenseDate(dates.end, language)}`;

  return <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.fill} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
        <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('wallet.eyebrow')}</Text>
        <Text style={[styles.title, { color: tokens.screenText }]}>{t(record ? 'budget.manage' : 'budget.set')}</Text>
        <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('budget.helper')}</Text>
        <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <SelectionField label={t('budget.period')} value={period} placeholder={t('budget.periodPlaceholder')} options={options} onSelect={(value) => { if (!saving && (value === 'weekly' || value === 'monthly')) setPeriod(value); }} labelOnCard />
          <View style={[styles.periodInfo, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
            <Text style={[styles.periodLabel, { color: tokens.brandCyan }]}>{t('budget.currentPeriod')}</Text>
            <Text style={[styles.periodRange, { color: tokens.cardText }]}>{periodRange}</Text>
          </View>
          {loading === 'loading' ? <View style={styles.status}><ActivityIndicator color={tokens.brandCyan} /><Text style={{ color: tokens.cardMutedText }}>{t('budget.loading')}</Text></View>
            : loading === 'error' ? <View style={styles.status}><Text style={{ color: tokens.cardErrorText }} accessibilityRole="alert">{t('budget.loadError')}</Text><Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.retry}><Text style={{ color: tokens.brandCyan }}>{t('wallet.retry')}</Text></Pressable></View>
              : <>
                <ExpenseTextField label={t('budget.amount')} value={amount} onChangeText={(value) => { setAmount(value); setAmountError(null); setSaveError(false); }} placeholder={t('budget.amountPlaceholder')} keyboardType="decimal-pad" prefix="RM" error={amountError ?? undefined} />
                {saveError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t('budget.saveError')}</Text>}
                <PrimaryButton onPress={() => { void save(); }} loading={saving}>{saving ? t('budget.saving') : t('budget.save')}</PrimaryButton>
              </>}
        </View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: spacing.space6 }, inner: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space5 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 },
  title: { ...typography.screenTitle, marginBottom: spacing.space2 }, helper: { ...typography.body, lineHeight: 23, marginBottom: spacing.space6 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space5 },
  periodInfo: { borderWidth: 1, borderRadius: radius.radiusMd, padding: spacing.space4, gap: spacing.space2 },
  periodLabel: { ...typography.label, letterSpacing: 1.5 }, periodRange: { ...typography.body, fontWeight: '600' },
  status: { gap: spacing.space3, alignItems: 'flex-start' }, retry: { minHeight: 44, justifyContent: 'center' },
  error: { ...typography.label },
});
