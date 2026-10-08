import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BudgetSummary } from '@/components/wallet/BudgetSummary';
import { ExpenseHistoryRow } from '@/components/wallet/ExpenseHistoryRow';
import { radius, spacing, typography } from '@/constants/theme';
import { currentBudgetPeriod } from '@/lib/budgetPeriod';
import type { BudgetPeriodType, BudgetRecord } from '@/lib/budgetPeriod';
import type { PeriodExpense } from '@/lib/budgetSummary';
import { expenseTotalCents, formatRinggit } from '@/lib/expenseHistory';
import type { ExpenseRecord } from '@/lib/expenseHistory';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type WalletState = 'loading' | 'ready' | 'error';
const PAGE_SIZE = 500;

export default function WalletScreen() {
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { saved, updated, deleted, budgetSaved, budgetPeriod } = useLocalSearchParams<{ saved?: string; updated?: string; deleted?: string; budgetSaved?: string; budgetPeriod?: string }>();
  const userId = session?.user.id;
  const selectedPeriod: BudgetPeriodType = budgetPeriod === 'weekly' ? 'weekly' : 'monthly';
  const [state, setState] = useState<WalletState>('loading');
  const [periodState, setPeriodState] = useState<WalletState>('loading');
  const [budget, setBudget] = useState<BudgetRecord | null>(null);
  const [periodExpenses, setPeriodExpenses] = useState<PeriodExpense[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const requestVersion = useRef(0);
  const periodRequestVersion = useRef(0);

  const loadPeriod = useCallback(async () => {
    const version = ++periodRequestVersion.current;
    setPeriodState('loading');
    setBudget(null);
    setPeriodExpenses([]);
    if (!userId) { setPeriodState('error'); return; }
    const dates = currentBudgetPeriod(selectedPeriod);
    try {
      const budgetResult = await supabase.from('budgets')
        .select('id,amount,period_type,period_start')
        .eq('user_id', userId)
        .eq('period_type', selectedPeriod)
        .eq('period_start', dates.start)
        .maybeSingle();
      if (version !== periodRequestVersion.current) return;
      if (budgetResult.error) throw budgetResult.error;
      const loaded: PeriodExpense[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase.from('expenses')
          .select('id,amount,category')
          .eq('user_id', userId)
          .gte('expense_date', dates.start)
          .lte('expense_date', dates.end)
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (version !== periodRequestVersion.current) return;
        if (error) throw error;
        const page = (data ?? []) as PeriodExpense[];
        loaded.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      setBudget(budgetResult.data as BudgetRecord | null);
      setPeriodExpenses(loaded);
      setPeriodState('ready');
    } catch {
      if (version === periodRequestVersion.current) { setBudget(null); setPeriodExpenses([]); setPeriodState('error'); }
    }
  }, [userId, selectedPeriod]);

  const loadWallet = useCallback(async (kind: 'initial' | 'refresh' = 'initial') => {
    const version = ++requestVersion.current;
    if (kind === 'refresh') setRefreshing(true);
    else setState('loading');
    if (!userId) {
      setState('error');
      setRefreshing(false);
      return;
    }
    try {
      const loaded: ExpenseRecord[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase.from('expenses')
          .select('id,title,amount,category,expense_date,notes,created_at')
          .eq('user_id', userId)
          .order('expense_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        if (version !== requestVersion.current) return;
        if (error) throw error;
        const page = (data ?? []) as ExpenseRecord[];
        loaded.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      setExpenses(loaded);
      setState('ready');
    } catch {
      if (version === requestVersion.current) {
        setExpenses([]);
        setState('error');
      }
    } finally {
      if (version === requestVersion.current) setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void loadWallet();
    void loadPeriod();
    return () => { ++requestVersion.current; ++periodRequestVersion.current; };
  }, [loadWallet, loadPeriod]));

  const hasExpenses = state === 'ready' && expenses.length > 0;
  const total = formatRinggit(expenseTotalCents(expenses) / 100);

  return <FlatList
    style={{ backgroundColor: tokens.screenBackground }}
    contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space6 }]}
    data={hasExpenses ? expenses : []}
    keyExtractor={(expense) => expense.id}
    renderItem={({ item }) => <ExpenseHistoryRow expense={item} onPress={() => router.push({ pathname: '/expense-detail', params: { id: item.id, budgetPeriod: selectedPeriod } })} />}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadWallet('refresh'); void loadPeriod(); }} tintColor={tokens.brandCyan} colors={[tokens.brandCyan]} accessibilityLabel={t('wallet.refreshing')} />}
    ListHeaderComponent={<>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('wallet.eyebrow')}</Text>
      <Text style={[styles.title, { color: tokens.screenText }]}>{t('tab.wallet')}</Text>
      {state === 'ready' && (saved === '1' || updated === '1' || deleted === '1') && <View style={[styles.success, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Ionicons name="checkmark-circle-outline" size={20} color={tokens.successText} /><Text style={[styles.successText, { color: tokens.cardText }]}>{deleted === '1' ? t('wallet.deleted') : updated === '1' ? t('wallet.updated') : t('wallet.saved')}</Text></View>}
      {budgetSaved === '1' && periodState === 'ready' && <View style={[styles.success, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Ionicons name="checkmark-circle-outline" size={20} color={tokens.successText} /><Text style={[styles.successText, { color: tokens.cardText }]}>{t('budget.saved')}</Text></View>}
      <BudgetSummary period={selectedPeriod} budget={budget} expenses={periodExpenses} hasAnyExpenses={hasExpenses} state={periodState}
        onSelectPeriod={(period) => { if (period !== selectedPeriod) router.setParams({ budgetPeriod: period }); }}
        onSetBudget={() => router.push({ pathname: '/set-budget', params: { period: selectedPeriod } })}
        onAddExpense={() => router.push({ pathname: '/add-expense', params: { budgetPeriod: selectedPeriod } })}
        onRetry={() => { void loadPeriod(); }} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('scan.entry')} onPress={() => router.push({ pathname: '/scan-receipt', params: { budgetPeriod: selectedPeriod } })} style={[styles.scanCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <View style={[styles.scanIcon, { backgroundColor: tokens.cardElevated }]}><Ionicons name="scan-outline" size={23} color={tokens.brandCyan} /></View>
        <View style={styles.scanCopy}><Text style={[styles.scanTitle, { color: tokens.cardText }]}>{t('scan.entry')}</Text><Text style={[styles.scanHint, { color: tokens.cardMutedText }]}>{t('scan.entryHint')}</Text></View>
        <Ionicons name="chevron-forward" size={19} color={tokens.cardMutedText} />
      </Pressable>
      {hasExpenses && <>
        <View style={[styles.summary, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <Text style={[styles.summaryEyebrow, { color: tokens.brandCyan }]}>{t('budget.allTimeSpent')}</Text>
          <Text style={[styles.total, { color: tokens.cardText }]}>{total}</Text>
          <Text style={[styles.count, { color: tokens.cardMutedText }]}>{expenses.length === 1 ? t('wallet.oneRecorded') : t('wallet.manyRecorded', { count: expenses.length })}</Text>
        </View>
        <Text style={[styles.sectionTitle, { color: tokens.screenText }]}>{t('wallet.recent')}</Text>
      </>}
    </>}
    ListEmptyComponent={state === 'ready' ? null : state === 'loading'
      ? <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><ActivityIndicator size="large" color={tokens.brandCyan} accessibilityLabel={t('wallet.loading')} /><Text style={[styles.description, { color: tokens.cardMutedText }]}>{t('wallet.loading')}</Text></View>
      : <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: tokens.cardElevated }]}><Ionicons name={state === 'error' ? 'alert-circle-outline' : 'wallet-outline'} size={28} color={tokens.brandCyan} /></View>
          <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{state === 'error' ? t('wallet.loadError') : t('wallet.emptyTitle')}</Text>
          <View style={styles.action}><Pressable accessibilityRole="button" onPress={() => { void loadWallet(); }} style={styles.retry}><Text style={[styles.retryText, { color: tokens.brandCyan }]}>{t('wallet.retry')}</Text></Pressable></View>
        </View>}
  />;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.space6, paddingBottom: 112 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 }, title: { ...typography.screenTitle, marginBottom: spacing.space6 },
  success: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, padding: spacing.space3, borderRadius: radius.radiusMd, borderWidth: 1, marginBottom: spacing.space4 },
  successText: { ...typography.body },
  summary: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space2 },
  summaryEyebrow: { ...typography.label, letterSpacing: 2 }, total: { ...typography.numeric, fontSize: 36 }, count: { ...typography.body },
  sectionTitle: { ...typography.sectionTitle, marginTop: spacing.space8, marginBottom: spacing.space4 },
  card: { minHeight: 250, alignItems: 'flex-start', borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space3 },
  iconWrap: { width: 56, height: 56, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.space2 },
  cardTitle: { ...typography.sectionTitle }, description: { ...typography.body, lineHeight: 23 }, action: { width: '100%', marginTop: spacing.space3 },
  retry: { minHeight: 44, justifyContent: 'center' }, retryText: { ...typography.body, fontWeight: '600' },
  scanCard: { minHeight: 86, borderWidth: 1, borderRadius: radius.radiusLg, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, padding: spacing.space4, marginBottom: spacing.space4 },
  scanIcon: { width: 48, height: 48, borderRadius: radius.radiusSm, alignItems: 'center', justifyContent: 'center' },
  scanCopy: { flex: 1, gap: spacing.space1 }, scanTitle: { ...typography.body, fontWeight: '700' }, scanHint: { ...typography.label, lineHeight: 18 },
});
