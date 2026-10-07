import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function SectionPlaceholder({ title, description, icon }: { title: string; description: string; icon: IconName }) {
  return (
    <Screen>
      <Text style={styles.eyebrow}>UNIFYD</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.card}>
        <View style={styles.iconWrap}><Ionicons name={icon} size={26} color={colors.brandCyan} /></View>
        <Text style={styles.cardTitle}>{title} is coming soon</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...typography.label, color: colors.brandCyan, letterSpacing: 2, marginBottom: spacing.space2 },
  title: { ...typography.screenTitle, color: colors.textPrimary, marginBottom: spacing.space6 },
  card: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space3 },
  iconWrap: { width: 52, height: 52, borderRadius: radius.radiusMd, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.space2 },
  cardTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  description: { ...typography.body, color: colors.textSecondary, lineHeight: 23 },
});
