import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AnimatedMoneyAmount } from '@/components/AnimatedMoneyAmount';
import { FinanceNumber } from '@/components/FinanceNumber';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { BudgetPeriodType } from '@/lib/budgetPeriod';
import { formatPercentage } from '@/lib/budgetSummary';
import type { calculateBudgetSummary } from '@/lib/budgetSummary';
import { formatRinggit } from '@/lib/expenseHistory';
import { budgetStatus, usageFraction } from '@/lib/walletOverview';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type Summary = ReturnType<typeof calculateBudgetSummary>;
const RING = 76;
const STROKE = 8;

/**
 * The first thing on Wallet: how much is available this period, with the budget and spending beside it.
 * The card is static; only the primary amount rolls (AnimatedMoneyAmount, reduced-motion aware).
 * Every value comes from `calculateBudgetSummary`; nothing is recalculated here.
 */
export function FinanceOverviewCard({ period, summary, state, memoryKey, onRetry, onSetBudget, embedded = false, play = true }: {
  period: BudgetPeriodType; summary: Summary; state: 'loading' | 'ready' | 'error'; memoryKey: string; onRetry: () => void; onSetBudget: () => void;
  /** Inside the Finance deck, on the Home overview's brand gradient: no own surface, white text. */
  embedded?: boolean;
  /** Whether the primary amount may roll (false while the card waits behind the deck's front card). */
  play?: boolean;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const status = budgetStatus(summary);
  const monthly = period === 'monthly';
  // On the blue gradient, text is white (as on the Home overview card); the amber "near" status sits on a
  // dark pill and "over" keeps its red pill, so both stay readable. Words always carry the meaning too.
  const c = embedded ? {
    text: colors.white, muted: 'rgba(255,255,255,0.85)', accent: colors.white, track: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.3)',
    error: colors.white, warning: colors.warning, warningBg: colors.background, buttonBg: 'rgba(255,255,255,0.18)', buttonBorder: 'rgba(255,255,255,0.4)',
  } : {
    text: tokens.cardText, muted: tokens.cardMutedText, accent: tokens.brandCyan, track: tokens.cardElevated, border: tokens.border,
    error: tokens.cardErrorText, warning: tokens.cardWarningText, warningBg: 'transparent', buttonBg: tokens.cardElevated, buttonBorder: tokens.border,
  };
  const card = embedded ? styles.embedded : [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];

  if (state !== 'ready') {
    return <View testID="budget-summary" style={card}>
      {state === 'loading' ? <View style={styles.message}><ActivityIndicator color={c.accent} /><Text style={[styles.muted, { color: c.muted }]}>{t('budget.summaryLoading')}</Text></View>
        : <View style={styles.message}>
          <Text style={[styles.muted, { color: c.error }]} accessibilityRole="alert">{t('budget.summaryError')}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.link}><Text style={[styles.linkText, { color: c.accent }]}>{t('wallet.retry')}</Text></Pressable>
        </View>}
    </View>;
  }

  const spent = formatRinggit(summary.spentCents / 100);
  const daily = summary.spentCents > 0 ? <View style={styles.figure}>
    <Text style={[styles.figureLabel, { color: c.muted }]}>{t('wallet.dailyAverageShort')}</Text>
    <FinanceNumber testID="budget-daily-average" style={[styles.figureValue, { color: c.text }]}>{formatRinggit(summary.dailyAverage)}</FinanceNumber>
  </View> : null;

  if (status === 'noBudget') {
    return <View testID="budget-summary" style={card}>
      <Text style={[styles.label, { color: c.muted }]}>{t(monthly ? 'wallet.spentMonthly' : 'wallet.spentWeekly')}</Text>
      <AnimatedMoneyAmount testID="budget-spent" play={play} cents={summary.spentCents} memoryKey={`${memoryKey}:spent`} accessibilityLabel={`${t(monthly ? 'wallet.spentMonthly' : 'wallet.spentWeekly')}, ${spent}`} style={[styles.primary, { color: c.text }]} />
      <View style={styles.noBudget}>
        <Ionicons name="flag-outline" size={18} color={c.muted} />
        <Text style={[styles.muted, styles.flex, { color: c.muted }]}>{t('budget.noBudget')}</Text>
      </View>
      <View style={styles.footer}>
        {daily}
        <Pressable accessibilityRole="button" onPress={onSetBudget} style={[styles.setBudget, { backgroundColor: c.buttonBg, borderColor: c.buttonBorder }]}>
          <Ionicons name="add" size={18} color={c.accent} /><Text style={[styles.linkText, { color: c.text }]}>{t('wallet.setBudgetAction')}</Text>
        </Pressable>
      </View>
    </View>;
  }

  const over = status === 'over';
  const tone = over ? c.error : status === 'near' ? c.warning : c.accent;
  const balance = formatRinggit(Math.abs(summary.balanceCents ?? 0) / 100);
  const label = over ? t('budget.overBudget') : t(monthly ? 'wallet.availableMonthly' : 'wallet.availableWeekly');
  const fraction = usageFraction(summary) ?? 0;
  const circumference = Math.PI * (RING - STROKE);
  const percent = formatPercentage(summary.percentageUsed ?? 0);

  return <View testID="budget-summary" style={card}>
    <View style={styles.top}>
      <View testID={over ? 'budget-overspent' : 'budget-remaining'} style={styles.primaryBlock}>
        {over ? <View testID="budget-status" style={[styles.pill, { backgroundColor: tokens.destructiveBackground }]}>
          <Ionicons name="alert-circle-outline" size={14} color={tokens.destructiveForeground} />
          <Text style={[styles.pillText, { color: tokens.destructiveForeground }]}>{label}</Text>
        </View> : <Text style={[styles.label, { color: c.muted }]}>{label}</Text>}
        <AnimatedMoneyAmount play={play} cents={Math.abs(summary.balanceCents ?? 0)} memoryKey={`${memoryKey}:${over ? 'over' : 'available'}`} accessibilityLabel={`${label}, ${balance}`} style={[styles.primary, { color: over ? c.error : c.text }]} />
        {status === 'near' && <View testID="budget-status" style={[styles.near, embedded && [styles.pill, { backgroundColor: c.warningBg }]]}>
          <Ionicons name="warning-outline" size={14} color={c.warning} />
          <Text style={[styles.pillText, { color: c.warning }]}>{t('wallet.nearBudget')}</Text>
        </View>}
      </View>
      {/* Usage ring: the percentage is always written inside it, so colour is never the only cue. */}
      <View style={styles.ring} accessible accessibilityRole="text" accessibilityLabel={t(monthly ? 'wallet.usedMonthlyA11y' : 'wallet.usedWeeklyA11y', { percent })}>
        <Svg width={RING} height={RING}>
          <Circle cx={RING / 2} cy={RING / 2} r={(RING - STROKE) / 2} stroke={c.track} strokeWidth={STROKE} fill="none" />
          <Circle cx={RING / 2} cy={RING / 2} r={(RING - STROKE) / 2} stroke={tone} strokeWidth={STROKE} fill="none" strokeLinecap="round"
            strokeDasharray={`${fraction * circumference} ${circumference}`} transform={`rotate(-90 ${RING / 2} ${RING / 2})`} />
        </Svg>
        <View style={styles.ringCenter} pointerEvents="none">
          <FinanceNumber testID="budget-used" style={[styles.ringValue, { color: c.text }]}>{percent}</FinanceNumber>
          <Text style={[styles.ringLabel, { color: c.muted }]}>{t('wallet.usedShort')}</Text>
        </View>
      </View>
    </View>
    <View style={[styles.footer, styles.figures, { borderTopColor: c.border }]}>
      <View style={styles.figure}>
        <Text style={[styles.figureLabel, { color: c.muted }]}>{t('wallet.budgetShort')}</Text>
        <FinanceNumber testID="budget-amount" style={[styles.figureValue, { color: c.text }]}>{formatRinggit((summary.budgetCents ?? 0) / 100)}</FinanceNumber>
      </View>
      <View style={styles.figure}>
        <Text style={[styles.figureLabel, { color: c.muted }]}>{t('wallet.spentShort')}</Text>
        <FinanceNumber testID="budget-spent" style={[styles.figureValue, { color: c.text }]}>{spent}</FinanceNumber>
      </View>
      {daily}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space4, gap: spacing.space3 },
  embedded: { padding: spacing.space4, gap: spacing.space3 },
  message: { minHeight: 96, justifyContent: 'center', alignItems: 'flex-start', gap: spacing.space2 },
  muted: { ...typography.body, lineHeight: 22 }, flex: { flex: 1 },
  link: { minHeight: 44, justifyContent: 'center' }, linkText: { ...typography.body, fontWeight: '600' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  primaryBlock: { flex: 1, minWidth: 0, gap: spacing.space1, alignItems: 'flex-start' },
  label: { ...typography.label }, primary: { ...typography.numeric, fontSize: 32 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.space1, paddingHorizontal: spacing.space2, paddingVertical: 2, borderRadius: radius.radiusFull },
  near: { flexDirection: 'row', alignItems: 'center', gap: spacing.space1 }, pillText: { ...typography.label, fontWeight: '600' },
  ring: { width: RING, height: RING }, ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 15 }, ringLabel: { fontSize: 11 },
  noBudget: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.space3 },
  figures: { borderTopWidth: 1, paddingTop: spacing.space3, justifyContent: 'flex-start', gap: spacing.space5 },
  figure: { gap: 2 }, figureLabel: { ...typography.label }, figureValue: { fontSize: 15 },
  setBudget: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space1, paddingHorizontal: spacing.space3, borderRadius: radius.radiusMd, borderWidth: 1 },
});
