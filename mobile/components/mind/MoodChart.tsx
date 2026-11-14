import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import type { MoodTrend } from '@/lib/moodTrends';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const MAX_BAR_HEIGHT = 80;

/** Daily mood (filled cyan) and stress (outlined) bars, shared by the Mind deck and the History trends view. */
export function MoodChart({ trend }: { trend: MoodTrend }) {
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const locale = language === 'ms' ? 'ms-MY' : 'en-MY';
  const formatScore = (value: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  const formatDay = (value: Date) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(value);
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chart} accessibilityLabel={t('mind.trendChart')}>
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
  </ScrollView>;
}

const styles = StyleSheet.create({
  chart: { alignItems: 'flex-end', gap: spacing.space1 },
  day: { width: 38, alignItems: 'center', gap: spacing.space2 },
  bars: { height: MAX_BAR_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  moodBar: { width: 9, borderRadius: radius.radiusFull }, stressBar: { width: 9, borderWidth: 2, borderRadius: radius.radiusFull },
  dayLabel: { fontSize: 10, textAlign: 'center' },
});
