import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

// Small, optional wellbeing invites under the Home deck: the daily check-in (SRS-FR-1104) and the reflection
// (SRS-FR-1106). In-app only, never a notification, never blocking; Not now hides it for the rest of the day.
export function HomeInviteCard({ testID, icon, title, body, actionLabel, onAction, onDismiss }: {
  testID: string; icon: ComponentProps<typeof Ionicons>['name']; title: string; body?: string; actionLabel: string; onAction: () => void; onDismiss: () => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
      <View style={styles.top}>
        <Ionicons name={icon} size={22} color={tokens.brandCyan} />
        <View style={styles.text}>
          <Text style={[styles.title, { color: tokens.cardText }]}>{title}</Text>
          {body && <Text style={[styles.body, { color: tokens.cardMutedText }]}>{body}</Text>}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable testID={`${testID}-open`} accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.button, { backgroundColor: tokens.brandBlue }, pressed && styles.pressed]}>
          <Text style={[styles.label, { color: colors.white }]}>{actionLabel}</Text>
        </Pressable>
        <Pressable testID={`${testID}-dismiss`} accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.button, styles.quiet, { borderColor: tokens.border }, pressed && styles.pressed]}>
          <Text style={[styles.label, { color: tokens.cardMutedText }]}>{t('wellbeing.notNow')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space4, marginTop: spacing.space4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  text: { flex: 1, gap: 2 },
  title: { ...typography.sectionTitle },
  body: { ...typography.label },
  // Buttons keep their natural width on the left, so Home's floating Poof launcher never covers them.
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space3, paddingRight: 72 },
  button: { minHeight: 48, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.space5 },
  quiet: { borderWidth: 1 },
  label: { ...typography.body, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
