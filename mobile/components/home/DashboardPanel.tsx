import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** A dark, tappable dashboard card that opens its detailed module. */
export function DashboardPanel({ title, icon, accessibilityLabel, onPress, children }: {
  title: string; icon: IconName; accessibilityLabel: string; onPress: () => void; children: ReactNode;
}) {
  const { tokens } = useAppearance();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: tokens.cardElevated }]}><Ionicons name={icon} size={20} color={tokens.brandCyan} /></View>
        <Text style={[styles.title, { color: tokens.cardText }]}>{title}</Text>
        <Ionicons name="chevron-forward" size={20} color={tokens.cardMutedText} />
      </View>
      <View style={styles.body}>{children}</View>
    </Pressable>
  );
}

/** One labelled figure inside a panel. Tone adds colour only alongside the text label. */
export function StatRow({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'danger' }) {
  const { tokens } = useAppearance();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: tokens.cardMutedText }]}>{label}</Text>
      <Text style={[styles.value, { color: tone === 'danger' ? tokens.cardErrorText : tokens.cardText }]}>{value}</Text>
    </View>
  );
}

export function PanelNote({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warning' }) {
  const { tokens } = useAppearance();
  return <Text style={[styles.note, { color: tone === 'warning' ? colors.warning : tokens.cardMutedText }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.radiusMd, borderWidth: 1, padding: spacing.space4, gap: spacing.space3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3, minHeight: 44 },
  iconWrap: { width: 40, height: 40, borderRadius: radius.radiusSm, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.sectionTitle, flex: 1 },
  body: { gap: spacing.space2 },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.space3 },
  label: { ...typography.label, flex: 1 },
  value: { ...typography.body, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  note: { ...typography.label, lineHeight: 19 },
});
