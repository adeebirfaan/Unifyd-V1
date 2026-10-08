import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/constants/theme';
import type { TranslationKey } from '@/constants/i18n';
import type { Direction, MoodTrend, TrendPeriod } from '@/lib/moodTrends';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error';
const MAX_BAR_HEIGHT = 80;
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
  const formatDay = (value: Date) => new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', { day: 'numeric', month: 'short' }).format(value);

  return <View testID="mind-trend-card" style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <Text style={[styles.heading, { color: tokens.cardText }]}>{t('mind.trendHeading')}</Text>
    <View style={styles.periods}>{([7, 30] as const).map((option) => <Pressable
      key={option} accessibilityRole="button" accessibilityState={{ selected: period === option }}
      accessibilityLabel={t(option === 7 ? 'mind.sevenDays' : 'mind.thirtyDays')}
      onPress={() => onPeriodChange(option)}
      style={[styles.periodButton, { borderColor: period === option ? tokens.brandCyan : tokens.border, backgroundColor: tokens.cardElevated }]}
    ><Text style={[styles.periodText, { color: period === option ? tokens.brandCyan : tokens.cardText }]}>{t(option === 7 ? 'mind.sevenDays' : 'mind.thirtyDays')}</Text></Pressable>)}</View>
    {state === 'loading' ? <View style={styles.state}><ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('mind.trendLoading')}</Text></View>
      : state === 'error' ? <View style={styles.state}><Text style={[styles.body, { color: tokens.cardText }]}>{t('mind.trendError')}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={[styles.retry, { borderColor: tokens.border }]}><Text style={[styles.periodText, { color: tokens.cardText }]}>{t('mind.retry')}</Text></Pressable></View>
        : !trend?.count ? <View style={styles.state}><Ionicons name="stats-chart-outline" size={26} color={tokens.brandCyan} /><Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('mind.trendEmpty')}</Text></View>
          : <>
            <View style={styles.metrics}>
              <View style={styles.metric}><Text style={[styles.metricLabel, { color: tokens.cardMutedText }]}>{t('mind.averageMood')}</Text><Text style={[styles.metricValue, { color: tokens.cardText }]}>{formatScore(trend.mood!)}</Text></View>
              <View style={styles.metric}><Text style={[styles.metricLabel, { color: tokens.cardMutedText }]}>{t('mind.averageStress')}</Text><Text style={[styles.metricValue, { color: tokens.cardText }]}>{formatScore(trend.stress!)}</Text></View>
            </View>
            <Text style={[styles.count, { color: tokens.cardMutedText }]}>{t(trend.count === 1 ? 'mind.oneCheckIn' : 'mind.manyCheckIns', { count: trend.count })}</Text>
            <View style={styles.legend}>
              <View style={styles.legendItem}><Ionicons name="happy-outline" size={17} color={tokens.brandCyan} /><Text style={[styles.legendText, { color: tokens.cardText }]}>{t('mind.mood')}</Text></View>
              <View style={styles.legendItem}><Ionicons name="pulse-outline" size={17} color={tokens.cardMutedText} /><Text style={[styles.legendText, { color: tokens.cardText }]}>{t('mind.stress')}</Text></View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chart} accessibilityLabel={t('mind.trendChart')}>
              {trend.days.map((day, index) => {
                const date = formatDay(day.date);
                return <View key={day.date.getTime()} testID={`mind-trend-day-${index}`} style={styles.day} accessible accessibilityRole="text" accessibilityLabel={day.count
                  ? t('mind.trendDay', { date, mood: formatScore(day.mood!), stress: formatScore(day.stress!) })
                  : t('mind.trendMissing', { date })}>
                  <View style={styles.bars}>{day.count > 0 && <>
                    <View style={[styles.moodBar, { height: Math.round(day.mood! / 5 * MAX_BAR_HEIGHT), backgroundColor: tokens.brandCyan }]} />
                    <View style={[styles.stressBar, { height: Math.round(day.stress! / 5 * MAX_BAR_HEIGHT), borderColor: tokens.cardMutedText }]} />
                  </>}</View>
                  <Text style={[styles.dayLabel, { color: tokens.cardMutedText }]}>{date}</Text>
                </View>;
              })}
            </ScrollView>
            {trend.comparison && <View style={[styles.comparison, { borderTopColor: tokens.border }]}>
              <Text style={[styles.comparisonTitle, { color: tokens.cardMutedText }]}>{t('mind.previousPeriod')}</Text>
              {trend.comparison.mood === 'similar' && trend.comparison.stress === 'similar'
                ? <Text style={[styles.body, { color: tokens.cardText }]}>{t('mind.averagesSimilar')}</Text>
                : <><Text style={[styles.body, { color: tokens.cardText }]}>{t(moodComparisonKeys[trend.comparison.mood])}</Text><Text style={[styles.body, { color: tokens.cardText }]}>{t(stressComparisonKeys[trend.comparison.stress])}</Text></>}
            </View>}
          </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space4 }, heading: { ...typography.sectionTitle },
  periods: { flexDirection: 'row', gap: spacing.space2 }, periodButton: { minHeight: 44, borderWidth: 1, borderRadius: radius.radiusFull, justifyContent: 'center', paddingHorizontal: spacing.space4 }, periodText: { ...typography.label },
  state: { gap: spacing.space3, alignItems: 'flex-start', paddingVertical: spacing.space3 }, body: { ...typography.body, lineHeight: 22 }, retry: { minHeight: 44, borderWidth: 1, borderRadius: radius.radiusMd, justifyContent: 'center', paddingHorizontal: spacing.space4 },
  metrics: { flexDirection: 'row', gap: spacing.space3 }, metric: { flex: 1, minWidth: 0 }, metricLabel: { ...typography.label }, metricValue: { ...typography.numeric, marginTop: spacing.space1 }, count: { ...typography.label },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space5 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }, legendText: { ...typography.label },
  chart: { alignItems: 'flex-end', gap: spacing.space1, paddingVertical: spacing.space2 }, day: { width: 42, alignItems: 'center', gap: spacing.space2 }, bars: { height: MAX_BAR_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  moodBar: { width: 9, borderRadius: radius.radiusFull }, stressBar: { width: 9, borderWidth: 2, borderRadius: radius.radiusFull }, dayLabel: { fontSize: 10, textAlign: 'center' },
  comparison: { borderTopWidth: 1, paddingTop: spacing.space4, gap: spacing.space2 }, comparisonTitle: { ...typography.label },
});
