import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { AVATARS } from '@/constants/avatars';
import type { AvatarId } from '@/constants/avatars';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * Grid of the 12 curated local avatars. The selection is shown by a tick badge,
 * a thicker ring, and a bold name, not by colour alone.
 */
export function AvatarPicker({ value, onChange, error }: { value: AvatarId; onChange: (id: AvatarId) => void; error?: string }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: tokens.screenText }]}>{t('avatar.title')}</Text>
      <Text style={[styles.hint, { color: tokens.mutedText }]}>{t('avatar.hint')}</Text>
      <View style={styles.grid} accessibilityRole="radiogroup" testID="avatar-picker">
        {AVATARS.map(({ id, labelKey }) => {
          const selected = value === id;
          return (
            <Pressable key={id} onPress={() => onChange(id)} accessibilityRole="radio"
              accessibilityLabel={t('avatar.select', { name: t(labelKey) })} accessibilityState={{ checked: selected }} aria-checked={selected}
              style={({ pressed }) => [styles.choice, { backgroundColor: selected ? tokens.cardElevated : tokens.cardBackground, borderColor: selected ? tokens.brandCyan : tokens.border }, selected && styles.selected, pressed && styles.pressed]}>
              <Avatar id={id} size={60} />
              <Text style={[styles.name, { color: selected ? tokens.cardText : tokens.cardMutedText }, selected && styles.nameSelected]} numberOfLines={2}>{t(labelKey)}</Text>
              {selected && <View style={[styles.check, { backgroundColor: tokens.brandCyan }]}><Ionicons name="checkmark" size={13} color={colors.background} /></View>}
            </Pressable>
          );
        })}
      </View>
      {error && <Text style={[styles.error, { color: tokens.errorText }]} accessibilityRole="alert">{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.space2 },
  title: { ...typography.sectionTitle },
  hint: { ...typography.body },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space3, marginTop: spacing.space2 },
  choice: { flexBasis: '30%', flexGrow: 1, minHeight: 112, alignItems: 'center', justifyContent: 'center', gap: spacing.space2, padding: spacing.space2, borderRadius: radius.radiusMd, borderWidth: 1 },
  selected: { borderWidth: 2.5 },
  pressed: { opacity: 0.85 },
  name: { ...typography.label, textAlign: 'center', lineHeight: 16 },
  nameSelected: { fontWeight: '700' },
  check: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: radius.radiusFull, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.label },
});
