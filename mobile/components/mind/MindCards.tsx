import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MoodChart } from '@/components/mind/MoodChart';
import type { TranslationKey } from '@/constants/i18n';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { Direction, MoodTrend, TrendEntry } from '@/lib/moodTrends';
import { suggestionKeys } from '@/lib/moodTrends';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];
export type TrendLoad = { state: 'loading' } | { state: 'error' } | { state: 'ready'; trend: MoodTrend };

// On the brand gradient everything is white, as on the Wallet and Studies main cards.
const onBlue = { text: colors.white, muted: 'rgba(255,255,255,0.85)', tile: 'rgba(255,255,255,0.18)' };
const moodKeys = { higher: 'mind.moodHigher', lower: 'mind.moodLower', similar: 'mind.moodSimilar' } as const satisfies Record<Direction, TranslationKey>;
const stressKeys = { higher: 'mind.stressHigher', lower: 'mind.stressLower', similar: 'mind.stressSimilar' } as const satisfies Record<Direction, TranslationKey>;

function Eyebrow({ icon, children, onHero = false }: { icon: IconName; children: string; onHero?: boolean }) {
  const { tokens } = useAppearance();
  const color = onHero ? onBlue.text : tokens.brandCyan;
  return <View style={styles.eyebrowRow}><Ionicons name={icon} size={18} color={color} /><Text style={[styles.eyebrow, { color }]}>{children}</Text></View>;
}

function Loading({ onHero = false }: { onHero?: boolean }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return <View style={styles.status}><ActivityIndicator color={onHero ? onBlue.text : tokens.brandCyan} /><Text style={[styles.body, { color: onHero ? onBlue.muted : tokens.cardMutedText }]}>{t('mind.trendLoading')}</Text></View>;
}

function Failed({ onRetry, onHero = false }: { onRetry: () => void; onHero?: boolean }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return <View style={styles.status}>
    <Text accessibilityRole="alert" style={[styles.body, { color: onHero ? onBlue.text : tokens.cardText }]}>{t('mind.trendError')}</Text>
    <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={[styles.retryText, { color: onHero ? onBlue.text : tokens.brandCyan }]}>{t('mind.retry')}</Text></Pressable>
  </View>;
}

/** Card 1, on the brand gradient: this week's average mood and stress, check-ins, and one comparison line. */
export function WeekDeckCard({ load, onRetry }: { load: TrendLoad; onRetry: () => void }) {
  const { language, t } = useI18n();
  const eyebrow = <Eyebrow icon="happy-outline" onHero>{t('mind.weekEyebrow')}</Eyebrow>;
  if (load.state === 'loading') return <View style={styles.card}>{eyebrow}<Loading onHero /></View>;
  if (load.state === 'error') return <View style={styles.card}>{eyebrow}<Failed onHero onRetry={onRetry} /></View>;
  const { trend } = load;
  if (!trend.count) return <View testID="mind-week" style={styles.card}>{eyebrow}<Text style={[styles.headline, { color: onBlue.text }]}>{t('mind.weekEmpty')}</Text></View>;
  const score = (value: number) => new Intl.NumberFormat(language === 'ms' ? 'ms-MY' : 'en-MY', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  const stats: { key: string; icon: IconName; label: string; value: string }[] = [
    { key: 'mood', icon: 'happy-outline', label: t('mind.averageMood'), value: score(trend.mood!) },
    { key: 'stress', icon: 'pulse-outline', label: t('mind.averageStress'), value: score(trend.stress!) },
    { key: 'count', icon: 'checkmark-done-outline', label: t('mind.statCheckIns'), value: String(trend.count) },
  ];
  const comparison = trend.comparison
    ? trend.comparison.mood === 'similar' && trend.comparison.stress === 'similar'
      ? t('mind.averagesSimilar') : `${t(moodKeys[trend.comparison.mood])} ${t(stressKeys[trend.comparison.stress])}`
    : null;
  return <View testID="mind-week" style={styles.card}>
    {eyebrow}
    <View style={styles.stats}>
      {stats.map((stat) => <View key={stat.key} testID={`mind-week-${stat.key}`} accessible accessibilityLabel={`${stat.label}: ${stat.value}`} style={[styles.stat, { backgroundColor: onBlue.tile }]}>
        <Ionicons name={stat.icon} size={18} color={onBlue.text} />
        <Text style={[styles.statValue, { color: onBlue.text }]}>{stat.value}</Text>
        <Text style={[styles.statLabel, { color: onBlue.muted }]} numberOfLines={2}>{stat.label}</Text>
      </View>)}
    </View>
    {comparison && <Text testID="mind-week-comparison" style={[styles.body, { color: onBlue.text }]}>{comparison}</Text>}
  </View>;
}

/** Card 2: the last seven days, one pair of bars per day. */
export function DailyDeckCard({ load, onRetry }: { load: TrendLoad; onRetry: () => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const eyebrow = <Eyebrow icon="bar-chart-outline">{t('mind.dailyEyebrow')}</Eyebrow>;
  if (load.state === 'loading') return <View style={styles.card}>{eyebrow}<Loading /></View>;
  if (load.state === 'error') return <View style={styles.card}>{eyebrow}<Failed onRetry={onRetry} /></View>;
  return <View testID="mind-daily" style={styles.card}>
    {eyebrow}
    {load.trend.count ? <>
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.swatch, { backgroundColor: tokens.brandCyan }]} /><Text style={[styles.legendText, { color: tokens.cardText }]}>{t('mind.mood')}</Text></View>
        <View style={styles.legendItem}><View style={[styles.swatch, styles.swatchOutline, { borderColor: tokens.cardMutedText }]} /><Text style={[styles.legendText, { color: tokens.cardText }]}>{t('mind.stress')}</Text></View>
      </View>
      <MoodChart trend={load.trend} />
    </> : <Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('mind.weekEmpty')}</Text>}
  </View>;
}

/** Card 3: up to two general ideas from the latest check-in (SDD §7.5 step 7), with the disclaimer (SRS-FR-610). */
export function IdeasDeckCard({ latest }: { latest: Pick<TrendEntry, 'mood_level' | 'stress_level'> | null }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return <View testID="mind-for-you-card" style={styles.card}>
    <Eyebrow icon="sparkles-outline">{t('mind.ideasEyebrow')}</Eyebrow>
    {suggestionKeys(latest).map((key) => <View key={key} style={styles.idea}>
      <Ionicons name="checkmark-circle-outline" size={18} color={tokens.brandCyan} />
      <Text style={[styles.body, { color: tokens.cardText }]}>{t(key)}</Text>
    </View>)}
    <Text style={[styles.small, { color: tokens.cardMutedText }]}>{t('mind.ideaDisclaimer')}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: spacing.space4, gap: spacing.space3 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  eyebrow: { ...typography.label, fontWeight: '700', letterSpacing: 1.5 },
  headline: { ...typography.sectionTitle, lineHeight: 25 },
  body: { ...typography.body, lineHeight: 22, flexShrink: 1 },
  small: { ...typography.label, lineHeight: 19 },
  status: { minHeight: 96, justifyContent: 'center', alignItems: 'flex-start', gap: spacing.space2 },
  retry: { minHeight: 44, justifyContent: 'center' }, retryText: { ...typography.body, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: spacing.space2 },
  stat: { flex: 1, borderRadius: radius.radiusMd, padding: spacing.space3, gap: 2 },
  statValue: { ...typography.sectionTitle }, statLabel: { ...typography.label, fontSize: 12 },
  legend: { flexDirection: 'row', gap: spacing.space5 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  swatch: { width: 10, height: 10, borderRadius: radius.radiusFull }, swatchOutline: { borderWidth: 2 }, legendText: { ...typography.label },
  idea: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space3 },
});
