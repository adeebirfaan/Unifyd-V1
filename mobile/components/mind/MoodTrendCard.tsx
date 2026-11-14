import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MoodChart } from '@/components/mind/MoodChart';

import { radius, spacing, typography } from '@/constants/theme';
import type { TranslationKey } from '@/constants/i18n';
import type { Direction, MoodTrend, TrendPeriod } from '@/lib/moodTrends';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error';
const moodComparisonKeys = {
  higher: 'mind.moodHigher', lower: 'mind.moodLower', similar: 'mind.moodSimilar',
} as const satisfies Record<Direction, TranslationKey>;
const stressComparisonKeys = {
  higher: 'mind.stressHigher', lower: 'mind.stressLower', similar: 'mind.stressSimilar',
} as const satisfies Record<Direction, TranslationKey>;

export function MoodTrendCard({ period, onPeriodChange, state, trend, onRetry }: {
  period: TrendPeriod;
  onPeriodChange: (value: TrendPeriod) => void;
  state: LoadState;
  trend: MoodTrend | null;
  onRetry: () => void;
}) {
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const formatScore = (value: number) => new Intl.NumberFormat(language === 'ms' ? 'ms-MY' : 'en-MY', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

  // Mind revamp (2026-11-15): no heading (the Trends switch names it), the legend lives in the two averages,
  // and the period choice sits beside the count, so the card reads top to bottom with few words.
  return <View testID="mind-trend-card" style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <View style={styles.top}>
      <Text style={[styles.count, { color: tokens.cardMutedText }]}>{state === 'ready' && trend?.count ? t(trend.count === 1 ? 'mind.oneCheckIn' : 'mind.manyCheckIns', { count: trend.count }) : ''}</Text>
      <View style={styles.periods}>{([7, 30] as const).map((option) => <Pressable
        key={option} accessibilityRole="button" accessibilityState={{ selected: period === option }}
        accessibilityLabel={t(option === 7 ? 'mind.sevenDays' : 'mind.thirtyDays')}
        onPress={() => onPeriodChange(option)}
        style={[styles.periodButton, { borderColor: period === option ? tokens.brandCyan : tokens.border, backgroundColor: tokens.cardElevated }]}
      ><Text style={[styles.periodText, { color: period === option ? tokens.brandCyan : tokens.cardText }]}>{t(option === 7 ? 'mind.sevenDays' : 'mind.thirtyDays')}</Text></Pressable>)}</View>
    </View>
    {state === 'loading' ? <View style={styles.state}><ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('mind.trendLoading')}</Text></View>
      : state === 'error' ? <View style={styles.state}><Text style={[styles.body, { color: tokens.cardText }]}>{t('mind.trendError')}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={[styles.retry, { borderColor: tokens.border }]}><Text style={[styles.periodText, { color: tokens.cardText }]}>{t('mind.retry')}</Text></Pressable></View>
        : !trend?.count ? <View style={styles.state}><Ionicons name="stats-chart-outline" size={26} color={tokens.brandCyan} /><Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('mind.trendEmpty')}</Text></View>
          : <>
            <View style={styles.metrics}>
              <View style={[styles.metric, { backgroundColor: tokens.cardElevated }]}>
                <View style={styles.metricHead}><Ionicons name="happy-outline" size={16} color={tokens.brandCyan} /><Text style={[styles.metricLabel, { color: tokens.cardMutedText }]}>{t('mind.averageMood')}</Text></View>
                <Text style={[styles.metricValue, { color: tokens.cardText }]}>{formatScore(trend.mood!)}</Text>
              </View>
              <View style={[styles.metric, { backgroundColor: tokens.cardElevated }]}>
                <View style={styles.metricHead}><Ionicons name="pulse-outline" size={16} color={tokens.cardMutedText} /><Text style={[styles.metricLabel, { color: tokens.cardMutedText }]}>{t('mind.averageStress')}</Text></View>
                <Text style={[styles.metricValue, { color: tokens.cardText }]}>{formatScore(trend.stress!)}</Text>
              </View>
            </View>
            <MoodChart trend={trend} />
            {trend.comparison && <View style={[styles.comparison, { borderTopColor: tokens.border }]}>
              <Text style={[styles.comparisonTitle, { color: tokens.cardMutedText }]}>{t('mind.previousPeriod')}</Text>
              {trend.comparison.mood === 'similar' && trend.comparison.stress === 'similar'
                ? <Text style={[styles.small, { color: tokens.cardText }]}>{t('mind.averagesSimilar')}</Text>
                : <><Text style={[styles.small, { color: tokens.cardText }]}>{t(moodComparisonKeys[trend.comparison.mood])}</Text><Text style={[styles.small, { color: tokens.cardText }]}>{t(stressComparisonKeys[trend.comparison.stress])}</Text></>}
            </View>}
          </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space3 }, count: { ...typography.label, flex: 1 },
  periods: { flexDirection: 'row', gap: spacing.space2 }, periodButton: { minHeight: 36, borderWidth: 1, borderRadius: radius.radiusFull, justifyContent: 'center', paddingHorizontal: spacing.space3 }, periodText: { ...typography.label },
  state: { gap: spacing.space3, alignItems: 'flex-start', paddingVertical: spacing.space2 }, body: { ...typography.body, lineHeight: 22 }, small: { ...typography.label, lineHeight: 19 }, retry: { minHeight: 44, borderWidth: 1, borderRadius: radius.radiusMd, justifyContent: 'center', paddingHorizontal: spacing.space4 },
  metrics: { flexDirection: 'row', gap: spacing.space3 }, metric: { flex: 1, minWidth: 0, borderRadius: radius.radiusMd, padding: spacing.space3, gap: spacing.space1 }, metricHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }, metricLabel: { ...typography.label, flexShrink: 1 }, metricValue: { ...typography.numeric },
  comparison: { borderTopWidth: 1, paddingTop: spacing.space3, gap: spacing.space1 }, comparisonTitle: { ...typography.label },
});
