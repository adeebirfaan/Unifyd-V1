import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { categoryIcons } from '@/components/wallet/ExpenseHistoryRow';
import { radius, spacing, typography } from '@/constants/theme';
import { currentBudgetPeriod } from '@/lib/budgetPeriod';
import type { BudgetPeriodType, BudgetRecord } from '@/lib/budgetPeriod';
import { calculateBudgetSummary, formatPercentage } from '@/lib/budgetSummary';
import type { PeriodExpense } from '@/lib/budgetSummary';
import { formatExpenseDate, formatRinggit } from '@/lib/expenseHistory';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type Props = {
  period: BudgetPeriodType;
  budget: BudgetRecord | null;
  expenses: readonly PeriodExpense[];
  hasAnyExpenses: boolean;
  state: 'loading' | 'ready' | 'error';
  onSelectPeriod: (period: BudgetPeriodType) => void;
  onSetBudget: () => void;
  onAddExpense: () => void;
  onRetry: () => void;
};

export function BudgetSummary({ period, budget, expenses, hasAnyExpenses, state, onSelectPeriod, onSetBudget, onAddExpense, onRetry }: Props) {
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const dates = currentBudgetPeriod(period);
  const summary = calculateBudgetSummary(budget?.amount ?? null, expenses, dates.start, dates.end);
  const overspent = summary.balanceCents !== null && summary.balanceCents < 0;

  return <>
    <View testID="budget-summary" style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
      <Text style={[styles.eyebrow, { color: tokens.brandCyan }]}>{t('budget.currentPeriod')}</Text>
      <View style={styles.periodSwitch}>
        {(['weekly', 'monthly'] as const).map((choice) => <Pressable
          key={choice}
          accessibilityRole="button"
          accessibilityLabel={t(`budget.${choice}`)}
          accessibilityState={{ selected: period === choice }}
          onPress={() => onSelectPeriod(choice)}
          style={[styles.periodButton, { backgroundColor: period === choice ? tokens.cardElevated : tokens.cardBackground, borderColor: period === choice ? tokens.brandCyan : tokens.border }]}
        ><Text style={[styles.periodButtonText, { color: period === choice ? tokens.cardText : tokens.cardMutedText }]}>{t(`budget.${choice}`)}</Text></Pressable>)}
      </View>
      <Text style={[styles.dateRange, { color: tokens.cardMutedText }]}>{formatExpenseDate(dates.start, language)} – {formatExpenseDate(dates.end, language)}</Text>

      {state === 'loading' && <Text style={[styles.message, { color: tokens.cardMutedText }]}>{t('budget.summaryLoading')}</Text>}
      {state === 'error' && <View style={styles.messageBlock}>
        <Text style={[styles.message, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t('budget.summaryError')}</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={[styles.retryText, { color: tokens.brandCyan }]}>{t('wallet.retry')}</Text></Pressable>
      </View>}
      {state === 'ready' && <>
        {budget ? <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: tokens.cardMutedText }]}>{t('budget.currentBudget')}</Text>
          <Text testID="budget-amount" style={[styles.budgetAmount, { color: tokens.cardText }]}>{formatRinggit(summary.budgetCents! / 100)}</Text>
        </View> : <Text style={[styles.message, { color: tokens.cardMutedText }]}>{t('budget.noBudget')}</Text>}
        <View style={[styles.divider, { backgroundColor: tokens.border }]} />
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: tokens.cardMutedText }]}>{t('budget.spent')}</Text>
          <Text testID="budget-spent" style={[styles.metricValue, { color: tokens.cardText }]}>{formatRinggit(summary.spentCents / 100)}</Text>
        </View>
        {summary.balanceCents !== null && <View testID={overspent ? 'budget-overspent' : 'budget-remaining'} style={[styles.balance, { backgroundColor: overspent ? tokens.destructiveBackground : tokens.cardElevated, borderColor: overspent ? tokens.destructiveBackground : tokens.brandCyan }]}>
          <Text style={[styles.balanceLabel, { color: overspent ? tokens.destructiveForeground : tokens.cardText }]}>{t(overspent ? 'budget.overBudget' : 'budget.remaining')}</Text>
          <Text style={[styles.balanceAmount, { color: overspent ? tokens.destructiveForeground : tokens.brandCyan }]}>{formatRinggit(Math.abs(summary.balanceCents) / 100)}</Text>
        </View>}
        <View style={styles.secondaryMetrics}>
          {summary.percentageUsed !== null && <View style={styles.secondaryMetric}>
            <Text style={[styles.metricLabel, { color: tokens.cardMutedText }]}>{t('budget.used')}</Text>
            <Text testID="budget-used" style={[styles.secondaryValue, { color: tokens.cardText }]}>{formatPercentage(summary.percentageUsed)}</Text>
          </View>}
          <View style={styles.secondaryMetric}>
            <Text style={[styles.metricLabel, { color: tokens.cardMutedText }]}>{t('budget.dailyAverage')}</Text>
            <Text testID="budget-daily-average" style={[styles.secondaryValue, { color: tokens.cardText }]}>{formatRinggit(summary.dailyAverage)}</Text>
          </View>
        </View>
        {!budget && <Text style={[styles.message, { color: tokens.cardMutedText }]}>{t(hasAnyExpenses ? 'budget.noBudgetWithExpenses' : 'budget.noBudgetNoExpenses')}</Text>}
        {budget && expenses.length === 0 && <Text style={[styles.message, { color: tokens.cardMutedText }]}>{t('budget.budgetNoExpenses')}</Text>}
        {expenses.length === 0 && hasAnyExpenses && <Text style={[styles.message, { color: tokens.cardMutedText }]}>{t('budget.periodNoExpenses')}</Text>}
        <View style={styles.actions}>
          <PrimaryButton onPress={onSetBudget}>{t(budget ? 'budget.manage' : 'budget.set')}</PrimaryButton>
          <Pressable accessibilityRole="button" onPress={onAddExpense} style={[styles.secondaryButton, { borderColor: tokens.border, backgroundColor: tokens.cardElevated }]}><Text style={[styles.secondaryButtonText, { color: tokens.cardText }]}>{t('wallet.add')}</Text></Pressable>
        </View>
      </>}
    </View>
    {state === 'ready' && summary.categories.length > 0 && <View style={[styles.categoryCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
      <Text style={[styles.categoryTitle, { color: tokens.cardText }]}>{t('budget.categories')}</Text>
      {summary.categories.map(({ category, cents, percentage }) => <View key={category} testID={`budget-category-${category}`} style={[styles.categoryRow, { borderTopColor: tokens.border }]}>
        <View style={[styles.categoryIcon, { backgroundColor: tokens.cardElevated }]}><Ionicons name={categoryIcons[category]} size={21} color={tokens.brandCyan} /></View>
        <View style={styles.categoryCopy}>
          <Text style={[styles.categoryLabel, { color: tokens.cardText }]}>{t(`expense.category.${category}`)}</Text>
          <Text style={[styles.categoryShare, { color: tokens.cardMutedText }]}>{t('budget.categoryShare', { percent: formatPercentage(percentage) })}</Text>
        </View>
        <Text style={[styles.categoryAmount, { color: tokens.cardText }]}>{formatRinggit(cents / 100)}</Text>
      </View>)}
    </View>}
  </>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space4, marginBottom: spacing.space4 },
  eyebrow: { ...typography.label, letterSpacing: 2 },
  periodSwitch: { flexDirection: 'row', gap: spacing.space2 },
  periodButton: { minHeight: 44, flex: 1, borderWidth: 1, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.space2 },
  periodButtonText: { ...typography.body, fontWeight: '600' }, dateRange: { ...typography.label },
  message: { ...typography.body, lineHeight: 23 }, messageBlock: { gap: spacing.space2 }, retry: { minHeight: 44, justifyContent: 'center' }, retryText: { ...typography.body, fontWeight: '600' },
  metric: { gap: spacing.space1 }, metricLabel: { ...typography.label }, budgetAmount: { ...typography.numeric, fontSize: 32 },
  divider: { height: 1 }, metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.space3 }, metricValue: { ...typography.sectionTitle },
  balance: { borderWidth: 1, borderRadius: radius.radiusMd, padding: spacing.space4, gap: spacing.space1 }, balanceLabel: { ...typography.label }, balanceAmount: { ...typography.numeric },
  secondaryMetrics: { flexDirection: 'row', gap: spacing.space3 }, secondaryMetric: { flex: 1, gap: spacing.space1 }, secondaryValue: { ...typography.body, fontWeight: '700' },
  actions: { gap: spacing.space3 }, secondaryButton: { minHeight: 54, borderWidth: 1, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center' }, secondaryButtonText: { ...typography.body, fontWeight: '700' },
  categoryCard: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, marginBottom: spacing.space4 }, categoryTitle: { ...typography.sectionTitle, marginBottom: spacing.space3 },
  categoryRow: { minHeight: 64, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingVertical: spacing.space3 },
  categoryIcon: { width: 44, height: 44, borderRadius: radius.radiusSm, alignItems: 'center', justifyContent: 'center' },
  categoryCopy: { flex: 1, gap: spacing.space1 }, categoryLabel: { ...typography.body, fontWeight: '600' }, categoryShare: { ...typography.label }, categoryAmount: { ...typography.body, fontWeight: '700' },
});
