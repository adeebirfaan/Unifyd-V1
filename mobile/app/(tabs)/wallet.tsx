import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FinanceNumber } from '@/components/FinanceNumber';
import { AllExpensesSheet } from '@/components/wallet/AllExpensesSheet';
import { ExpenseDateHeader } from '@/components/wallet/ExpenseDateHeader';
import { ExpenseHistoryRow } from '@/components/wallet/ExpenseHistoryRow';
import { FinanceAttentionCard } from '@/components/wallet/FinanceAttentionCard';
import { FinanceDeck } from '@/components/wallet/FinanceDeck';
import { FinanceOverviewCard } from '@/components/wallet/FinanceOverviewCard';
import { FinanceQuickActions } from '@/components/wallet/FinanceQuickActions';
import { SpendingBreakdownCard } from '@/components/wallet/SpendingBreakdownCard';
import { radius, spacing, typography } from '@/constants/theme';
import { useFinancePlans } from '@/hooks/useFinancePlans';
import { currentBudgetPeriod } from '@/lib/budgetPeriod';
import type { BudgetPeriodType, BudgetRecord } from '@/lib/budgetPeriod';
import { calculateBudgetSummary } from '@/lib/budgetSummary';
import type { PeriodExpense } from '@/lib/budgetSummary';
import { groupExpensesByDate } from '@/lib/expenseGroups';
import { expenseTotalCents, formatExpenseDate, formatRinggit } from '@/lib/expenseHistory';
import type { ExpenseRecord } from '@/lib/expenseHistory';
import { supabase } from '@/lib/supabase';
import { attentionItems } from '@/lib/walletOverview';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type WalletState = 'loading' | 'ready' | 'error';
const PAGE_SIZE = 500;
// Wallet home is a dashboard: it previews the newest expenses; the full history opens in a sheet.
const PREVIEW_LIMIT = 5;

/**
 * Wallet home, in priority order: overview (available this period) → quick actions → this period's
 * spending by category → attention items (only when actionable) → recent expenses.
 * All figures come from the existing calculations; split bills and subscriptions stay separate.
 */
export default function WalletScreen() {
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
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
  const plans = useFinancePlans(userId);
  const [historyOpen, setHistoryOpen] = useState(false);

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
  const preview = hasExpenses ? expenses.slice(0, PREVIEW_LIMIT) : [];
  // At most five rows in total, with a date header only for the days those rows cover.
  const previewSections = groupExpensesByDate(preview).map((group) => ({ ...group, key: group.date, data: group.expenses }));
  const openExpense = (expense: ExpenseRecord) => router.push({ pathname: '/expense-detail', params: { id: expense.id, budgetPeriod: selectedPeriod } });
  const totalCents = expenseTotalCents(expenses);
  const total = formatRinggit(totalCents / 100);
  const dates = currentBudgetPeriod(selectedPeriod);
  const summary = calculateBudgetSummary(budget?.amount ?? null, periodExpenses, dates.start, dates.end);
  const attention = periodState === 'ready' ? attentionItems({ summary, renewals: plans.renewals, owedCents: plans.owedCents }) : [];
  const openBudget = () => router.push({ pathname: '/set-budget', params: { period: selectedPeriod } });
  const addExpense = () => router.push({ pathname: '/add-expense', params: { budgetPeriod: selectedPeriod } });
  const notice = (text: string) => <View style={[styles.success, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Ionicons name="checkmark-circle-outline" size={20} color={tokens.successText} /><Text style={[styles.successText, { color: tokens.cardText }]}>{text}</Text></View>;

  return <><SectionList
    style={{ backgroundColor: tokens.screenBackground }}
    contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4 }]}
    sections={previewSections}
    keyExtractor={(expense) => expense.id}
    stickySectionHeadersEnabled={false}
    renderSectionHeader={({ section }) => <ExpenseDateHeader date={section.date} totalCents={section.totalCents} />}
    renderItem={({ item, index, section }) => <ExpenseHistoryRow expense={item} first={index === 0} last={index === section.data.length - 1} onPress={() => openExpense(item)} />}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadWallet('refresh'); void loadPeriod(); }} tintColor={tokens.brandCyan} colors={[tokens.brandCyan]} accessibilityLabel={t('wallet.refreshing')} />}
    ListHeaderComponent={<View style={styles.header}>
      {/* 1. Compact header: title, period switch, and a secondary date range. */}
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('wallet.eyebrow')}</Text>
          <Text style={[styles.title, { color: tokens.screenText }]}>{t('tab.wallet')}</Text>
        </View>
        <View style={[styles.periodSwitch, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          {(['weekly', 'monthly'] as const).map((choice) => {
            const selected = selectedPeriod === choice;
            return <Pressable key={choice} accessibilityRole="button" accessibilityLabel={t(`budget.${choice}`)} accessibilityState={{ selected }}
              onPress={() => { if (!selected) router.setParams({ budgetPeriod: choice }); }}
              style={[styles.periodButton, selected && { backgroundColor: tokens.cardElevated }]}>
              <Text style={[styles.periodText, { color: selected ? tokens.cardText : tokens.cardMutedText }]}>{t(`budget.${choice}`)}</Text>
            </Pressable>;
          })}
        </View>
      </View>
      <Text testID="wallet-period-range" style={[styles.range, { color: tokens.mutedText }]}>{formatExpenseDate(dates.start, language)} – {formatExpenseDate(dates.end, language)}</Text>
      {state === 'ready' && (saved === '1' || updated === '1' || deleted === '1') && notice(deleted === '1' ? t('wallet.deleted') : updated === '1' ? t('wallet.updated') : t('wallet.saved'))}
      {budgetSaved === '1' && periodState === 'ready' && notice(t('budget.saved'))}

      {/* 2. Insight deck (same stacked, swipeable deck as Home): overview first, then by category, then
          needs attention only when there is something to act on. */}
      <FinanceDeck cards={[
        { key: 'overview', name: t('wallet.deckOverview'), surface: 'hero', render: (front) => <FinanceOverviewCard embedded play={front} period={selectedPeriod} summary={summary} state={periodState}
          memoryKey={`wallet-overview:${userId}:${selectedPeriod}`} onRetry={() => { void loadPeriod(); }} onSetBudget={openBudget} /> },
        // While the period reloads (for example on returning to Wallet), the category card stays in the deck with
        // a loading state, so the deck keeps its place instead of collapsing and rebuilding.
        ...(periodState !== 'error' ? [{ key: 'categories', name: t('wallet.deckCategories'), surface: 'plain' as const, render: () => periodState === 'ready'
          ? <SpendingBreakdownCard embedded period={selectedPeriod} spentCents={summary.spentCents} categories={summary.categories} hasOlderExpenses={hasExpenses} hasBudget={!!budget} onAddExpense={addExpense} />
          : <View testID="breakdown-loading" style={styles.deckLoading}><ActivityIndicator color={tokens.brandCyan} accessibilityLabel={t('budget.summaryLoading')} /></View> }] : []),
        ...(attention.length ? [{ key: 'attention', name: t('wallet.deckAttention'), surface: 'plain' as const, render: () => <FinanceAttentionCard embedded items={attention} period={selectedPeriod}
          onBudget={openBudget} onSubscriptions={() => router.push('/subscriptions')} onSplitBills={() => router.push('/split-bills')} /> }] : []),
      ]} />
      {/* 3. Compact shortcuts. */}
      <FinanceQuickActions hasBudget={!!budget} onAddExpense={addExpense}
        onScan={() => router.push({ pathname: '/scan-receipt', params: { budgetPeriod: selectedPeriod } })}
        onBudget={openBudget} onSplitBills={() => router.push('/split-bills')} onSubscriptions={() => router.push('/subscriptions')} />

      {/* 6. Recent expenses, with the all-time total as a quiet summary. */}
      <View style={styles.recentHeader}>
        <View style={styles.recentTitleRow}>
          <Text style={[styles.sectionTitle, { color: tokens.screenText }]}>{t('wallet.recent')}</Text>
          {state === 'ready' && expenses.length > PREVIEW_LIMIT && <Pressable testID="view-all-expenses" accessibilityRole="button"
            accessibilityLabel={t('wallet.viewAllA11y', { count: expenses.length })} accessibilityHint={t('wallet.viewAllHint')} onPress={() => setHistoryOpen(true)}
            style={({ pressed }) => [styles.viewAll, pressed && styles.pressed]}>
            <Text style={[styles.viewAllText, { color: tokens.pageAccent }]}>{t('wallet.viewAll', { count: expenses.length })}</Text>
            <Ionicons name="chevron-forward" size={16} color={tokens.pageAccent} />
          </Pressable>}
        </View>
        {hasExpenses && <View testID="wallet-total" accessible accessibilityRole="text" accessibilityLabel={t('wallet.totalLabel', { amount: total })} style={styles.allTime}>
          <Text style={[styles.allTimeLabel, { color: tokens.mutedText }]}>{t('wallet.allTimeShort')}</Text>
          <FinanceNumber style={[styles.allTimeValue, { color: tokens.screenText }]}>{total}</FinanceNumber>
          <Text style={[styles.allTimeLabel, { color: tokens.mutedText }]}>{expenses.length === 1 ? t('wallet.oneRecorded') : t('wallet.manyRecorded', { count: expenses.length })}</Text>
        </View>}
      </View>
    </View>}
    ListEmptyComponent={state === 'ready'
      ? <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <Ionicons name="wallet-outline" size={24} color={tokens.brandCyan} />
          <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('wallet.emptyTitle')}</Text>
          <Text style={[styles.description, { color: tokens.cardMutedText }]}>{t('wallet.emptyBody')}</Text>
        </View>
      : state === 'loading'
        ? <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><ActivityIndicator color={tokens.brandCyan} accessibilityLabel={t('wallet.loading')} /><Text style={[styles.description, { color: tokens.cardMutedText }]}>{t('wallet.loading')}</Text></View>
        : <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
            <Ionicons name="alert-circle-outline" size={24} color={tokens.brandCyan} />
            <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('wallet.loadError')}</Text>
            <Pressable accessibilityRole="button" onPress={() => { void loadWallet(); }} style={styles.retry}><Text style={[styles.retryText, { color: tokens.brandCyan }]}>{t('wallet.retry')}</Text></Pressable>
          </View>}
  />
  <AllExpensesSheet visible={historyOpen} expenses={state === 'ready' ? expenses : []} onClose={() => setHistoryOpen(false)}
    onOpenExpense={(expense) => { setHistoryOpen(false); openExpense(expense); }} />
  </>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.space6, paddingBottom: 112 },
  header: { gap: spacing.space3, marginBottom: spacing.space3 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.space3 },
  titleCopy: { flexShrink: 1 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space1 }, title: { ...typography.screenTitle },
  periodSwitch: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.radiusFull, padding: 3 },
  periodButton: { minHeight: 38, minWidth: 44, paddingHorizontal: spacing.space3, borderRadius: radius.radiusFull, alignItems: 'center', justifyContent: 'center' },
  periodText: { ...typography.label, fontWeight: '600' },
  range: { ...typography.label, marginTop: -spacing.space2 },
  success: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, padding: spacing.space3, borderRadius: radius.radiusMd, borderWidth: 1 },
  successText: { ...typography.body, flex: 1 },
  recentHeader: { gap: spacing.space1, marginTop: spacing.space2 },
  recentTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space2 },
  viewAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: spacing.space2 },
  viewAllText: { ...typography.label, fontWeight: '700' }, pressed: { opacity: 0.7 },
  sectionTitle: { ...typography.sectionTitle },
  allTime: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.space1 },
  allTimeLabel: { ...typography.label }, allTimeValue: { fontSize: 13 },
  deckLoading: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  card: { alignItems: 'flex-start', borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space2 },
  cardTitle: { ...typography.body, fontWeight: '700' }, description: { ...typography.body, lineHeight: 22 },
  retry: { minHeight: 44, justifyContent: 'center' }, retryText: { ...typography.body, fontWeight: '600' },
});
