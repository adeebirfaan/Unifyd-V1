import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { FinanceNumber } from '@/components/FinanceNumber';
import { categoryIcons } from '@/components/wallet/ExpenseHistoryRow';
import { categoryPalette, radius, spacing, typography } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { BudgetPeriodType } from '@/lib/budgetPeriod';
import { formatPercentage } from '@/lib/budgetSummary';
import type { CategorySpending } from '@/lib/budgetSummary';
import { formatRinggit } from '@/lib/expenseHistory';
import { donutSegments, topCategories } from '@/lib/walletOverview';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const SIZE = 100;
const STROKE = 12;
const GAP = 0.008;
// The donut sweeps in once per app session. Later renders, refocuses, and period changes draw it complete.
const revealed = new Set<string>();

/** Real spending in the selected period by category: a donut of every category with the top three listed. */
export function SpendingBreakdownCard({ period, spentCents, categories, hasBudget, hasOlderExpenses, onAddExpense, embedded = false }: {
  period: BudgetPeriodType; spentCents: number; categories: readonly CategorySpending[];
  /** True when the student has expenses outside this period, so the empty state can say they are not counted. */
  hasOlderExpenses: boolean; hasBudget: boolean; onAddExpense: () => void;
  /** Inside the Finance deck, whose card supplies the surface and border. */
  embedded?: boolean;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(revealed.has('chart') ? 1 : 0));
  const [reveal, setReveal] = useState(revealed.has('chart') ? 1 : 0);
  const hasSpending = spentCents > 0;

  useEffect(() => {
    const id = progress.addListener(({ value }) => setReveal(value));
    return () => progress.removeListener(id);
  }, [progress]);
  useEffect(() => {
    if (!hasSpending || revealed.has('chart')) return;
    if (reduceMotion) { revealed.add('chart'); progress.setValue(1); return; }
    const animation = Animated.timing(progress, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) revealed.add('chart'); });
    return () => animation.stop();
  }, [hasSpending, reduceMotion, progress]);

  const title = t(period === 'monthly' ? 'wallet.breakdownMonthly' : 'wallet.breakdownWeekly');
  const card = embedded ? styles.embedded : [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];
  if (!hasSpending) {
    return <View testID="spending-breakdown" style={card}>
      <Text style={[styles.title, { color: tokens.cardText }]}>{title}</Text>
      <View style={styles.empty}>
        <Ionicons name="pie-chart-outline" size={22} color={tokens.cardMutedText} />
        <Text style={[styles.muted, { color: tokens.cardMutedText }]}>{hasBudget ? t('budget.budgetNoExpenses') : t(period === 'monthly' ? 'wallet.breakdownEmptyMonthly' : 'wallet.breakdownEmptyWeekly')}</Text>
      </View>
      {hasOlderExpenses && <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('budget.periodNoExpenses')}</Text>}
      <Pressable accessibilityRole="button" onPress={onAddExpense} style={[styles.action, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
        <Ionicons name="add" size={18} color={tokens.brandCyan} /><Text style={[styles.actionText, { color: tokens.cardText }]}>{t('wallet.addFirstPeriod')}</Text>
      </Pressable>
    </View>;
  }

  const { top, restCount, restCents } = topCategories(categories);
  const segments = donutSegments(categories);
  const r = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const spent = formatRinggit(spentCents / 100);
  const summary = [t('wallet.breakdownA11y', { title, amount: spent }),
    ...top.map((entry) => `${t(`expense.category.${entry.category}`)} ${formatRinggit(entry.cents / 100)}, ${formatPercentage(entry.percentage)}`),
    ...(restCount ? [t(restCount === 1 ? 'wallet.breakdownMoreOne' : 'wallet.breakdownMoreMany', { count: restCount, amount: formatRinggit(restCents / 100) })] : [])].join('. ');

  return <View testID="spending-breakdown" style={card}>
    <Text style={[styles.title, { color: tokens.cardText }]}>{title}</Text>
    <View style={styles.body}>
      <View style={styles.donut} accessible accessibilityRole="image" accessibilityLabel={summary}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={tokens.cardElevated} strokeWidth={STROKE} fill="none" />
          {segments.map((segment) => {
            // The sweep reveals segments in order; a hairline gap separates neighbouring categories.
            const visible = Math.max(0, Math.min(segment.length, reveal - segment.start) - (segments.length > 1 ? GAP : 0));
            return visible > 0 ? <Circle key={segment.category} cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke={categoryPalette[segment.category]} strokeWidth={STROKE}
              strokeDasharray={`${visible * circumference} ${circumference}`} transform={`rotate(${segment.start * 360 - 90} ${SIZE / 2} ${SIZE / 2})`} /> : null;
          })}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.centerLabel, { color: tokens.cardMutedText }]}>{t('wallet.spentShort')}</Text>
          <FinanceNumber fit testID="breakdown-spent" style={[styles.centerValue, { color: tokens.cardText }]}>{spent}</FinanceNumber>
        </View>
      </View>
      <View style={styles.legend}>
        {top.map((entry) => <View key={entry.category} testID={`budget-category-${entry.category}`} style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: categoryPalette[entry.category] }]} />
          <Ionicons name={categoryIcons[entry.category]} size={16} color={tokens.cardMutedText} />
          <View style={styles.legendCopy}>
            <Text style={[styles.legendName, { color: tokens.cardText }]} numberOfLines={1}>{t(`expense.category.${entry.category}`)}</Text>
            <Text style={[styles.legendValue, { color: tokens.cardMutedText }]}>
              <FinanceNumber style={[styles.legendNumber, { color: tokens.cardText }]}>{formatRinggit(entry.cents / 100)}</FinanceNumber>{' · '}{formatPercentage(entry.percentage)}
            </Text>
          </View>
        </View>)}
        {restCount > 0 && <Text testID="breakdown-more" style={[styles.more, { color: tokens.cardMutedText }]}>{t(restCount === 1 ? 'wallet.breakdownMoreOne' : 'wallet.breakdownMoreMany', { count: restCount, amount: formatRinggit(restCents / 100) })}</Text>}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space4, gap: spacing.space3 },
  embedded: { padding: spacing.space4, gap: spacing.space3 },
  title: { ...typography.body, fontWeight: '700' },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.space4 },
  donut: { width: SIZE, height: SIZE }, center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: STROKE + 4 },
  centerLabel: { fontSize: 11 }, centerValue: { fontSize: 13 },
  legend: { flex: 1, minWidth: 0, gap: spacing.space3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendCopy: { flex: 1, minWidth: 0 }, legendName: { ...typography.label, fontWeight: '600' },
  legendValue: { fontSize: 12 }, legendNumber: { fontSize: 12 },
  more: { fontSize: 12 }, hint: { ...typography.label, lineHeight: 18 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }, muted: { ...typography.body, lineHeight: 22, flex: 1 },
  action: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.space1, paddingHorizontal: spacing.space3, borderRadius: radius.radiusMd, borderWidth: 1 },
  actionText: { ...typography.body, fontWeight: '600' },
});
