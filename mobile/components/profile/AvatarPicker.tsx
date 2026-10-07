import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { AVATARS } from '@/constants/avatars';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export function AvatarPicker({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: tokens.screenText }]}>{t('avatar.title')}</Text>
      <Text style={[styles.hint, { color: tokens.mutedText }]}>{t('avatar.hint')}</Text>
      <View style={styles.grid}>
        {AVATARS.map(({ id }, index) => (
          <Pressable key={id} onPress={() => onChange(id)} accessibilityRole="radio" accessibilityLabel={t('avatar.option', { number: index + 1 })} accessibilityState={{ selected: value === id }} style={[styles.choice, value === id && styles.selected]}>
            <Avatar id={id} size={64} />
            {value === id && <View style={styles.check}><Ionicons name="checkmark" size={13} color={colors.background} /></View>}
          </Pressable>
        ))}
      </View>
      {error && <Text style={[styles.error, { color: tokens.errorText }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.space2 },
  title: { ...typography.sectionTitle, color: colors.textPrimary },
  hint: { ...typography.body, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.space3, marginTop: spacing.space2 },
  choice: { width: '30%', minHeight: 82, alignItems: 'center', justifyContent: 'center', borderRadius: radius.radiusMd, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  selected: { borderColor: colors.brandBlue, backgroundColor: colors.surfaceElevated },
  check: { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: radius.radiusFull, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandCyan },
  error: { ...typography.label, color: colors.danger },
});
