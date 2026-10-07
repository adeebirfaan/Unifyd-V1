import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function ModuleCard({ title, description, icon }: { title: string; description: string; icon: IconName }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}><Ionicons name={icon} size={22} color={colors.brandCyan} /></View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: spacing.space4, padding: spacing.space4, borderRadius: radius.radiusMd, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 44, height: 44, borderRadius: radius.radiusSm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
  copy: { flex: 1, gap: spacing.space1 },
  title: { ...typography.sectionTitle, color: colors.textPrimary },
  description: { ...typography.label, color: colors.textSecondary, lineHeight: 18 },
});
