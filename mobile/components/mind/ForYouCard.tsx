import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/constants/theme';
import type { TrendEntry } from '@/lib/moodTrends';
import { suggestionKeys } from '@/lib/moodTrends';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export function ForYouCard({ latest }: { latest: Pick<TrendEntry, 'mood_level' | 'stress_level'> | null }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return <View testID="mind-for-you-card" style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <Text style={[styles.heading, { color: tokens.cardText }]}>{t('mind.forYou')}</Text>
    {!latest && <Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('mind.generalIdeas')}</Text>}
    {suggestionKeys(latest).map((key) => <View key={key} style={styles.idea}>
      <Ionicons name="sparkles-outline" size={18} color={tokens.brandCyan} />
      <Text style={[styles.body, { color: tokens.cardText }]}>{t(key)}</Text>
    </View>)}
    <Text style={[styles.disclaimer, { color: tokens.cardMutedText }]}>{t('mind.ideaDisclaimer')}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space4 },
  heading: { ...typography.sectionTitle }, body: { ...typography.body, flex: 1, lineHeight: 22 },
  idea: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space3 }, disclaimer: { ...typography.label, lineHeight: 19 },
});
