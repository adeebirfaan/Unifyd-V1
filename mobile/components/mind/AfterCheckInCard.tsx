import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import type { CheckInLevels } from '@/lib/wellbeing';
import { checkInFollowUp } from '@/lib/wellbeing';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

// Wellbeing Phase 3 (SRS-FR-1103): shown only right after a check-in is saved. Optional and dismissible;
// it never blocks the check-in or the app.
export function AfterCheckInCard({ levels, onBreathe, onDismiss }: { levels: CheckInLevels; onBreathe: () => void; onDismiss: () => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const followUp = checkInFollowUp(levels);
  return (
    <View testID="mind-after-checkin" style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
      {followUp.breathing && <View style={styles.breathe}>
        <Text style={[styles.title, { color: tokens.cardText }]}>{t('wellbeing.after.breatheTitle')}</Text>
        <Pressable testID="mind-after-breathe" accessibilityRole="button" accessibilityLabel={t('wellbeing.after.breatheA11y')} onPress={onBreathe}
          style={({ pressed }) => [styles.start, { backgroundColor: tokens.brandBlue }, pressed && styles.pressed]}>
          <Ionicons name="leaf-outline" size={18} color={colors.white} />
          <Text style={styles.startText}>{t('wellbeing.breathe.start')}</Text>
        </Pressable>
      </View>}
      <View style={styles.tips}>
        {followUp.tips.map((key) => <View key={key} style={styles.tip}>
          <Ionicons name="sparkles-outline" size={18} color={tokens.brandCyan} />
          <Text style={[styles.tipText, { color: tokens.cardText }]}>{t(key)}</Text>
        </View>)}
      </View>
      <Pressable testID="mind-after-dismiss" accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
        <Text style={[styles.dismissText, { color: tokens.cardMutedText }]}>{t('wellbeing.notNow')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space4 },
  breathe: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  title: { ...typography.sectionTitle, flex: 1 },
  start: { minHeight: 44, borderRadius: radius.radiusFull, flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingHorizontal: spacing.space4 },
  startText: { ...typography.body, fontWeight: '700', color: colors.white },
  tips: { gap: spacing.space3 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space3 },
  tipText: { ...typography.body, flex: 1, lineHeight: 22 },
  dismiss: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  dismissText: { ...typography.label, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
