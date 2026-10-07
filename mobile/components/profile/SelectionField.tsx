import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export type SelectionOption = { id: string; label: string };

export function SelectionField({ label, value, placeholder, options, onSelect, error, labelOnCard = false }: {
  label: string;
  value: string | null;
  placeholder: string;
  options: readonly SelectionOption[];
  onSelect: (id: string) => void;
  error?: string;
  labelOnCard?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const selected = options.find((option) => option.id === value);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: labelOnCard ? tokens.cardText : tokens.screenText }]}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`} onPress={() => setVisible(true)} style={[styles.control, error && styles.controlError]}>
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={2}>{selected?.label ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </Pressable>
      {error && <Text style={[styles.error, { color: labelOnCard ? tokens.cardErrorText : tokens.errorText }]}>{error}</Text>}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.scrim} accessibilityLabel={t('common.closeChoices')} onPress={() => setVisible(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.space4) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setVisible(false)} accessibilityRole="button" accessibilityLabel={t('common.closeChoices')} style={styles.close}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView style={styles.options} keyboardShouldPersistTaps="handled">
              {options.map((option) => (
                <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ selected: value === option.id }} onPress={() => { onSelect(option.id); setVisible(false); }} style={[styles.option, value === option.id && styles.optionSelected]}>
                  <Text style={[styles.optionText, value === option.id && styles.optionTextSelected]}>{option.label}</Text>
                  {value === option.id && <Ionicons name="checkmark-circle" size={22} color={colors.brandCyan} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.space2 },
  label: { ...typography.label, color: colors.textPrimary },
  control: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3, borderRadius: radius.radiusMd, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  controlError: { borderColor: colors.danger },
  value: { ...typography.body, color: colors.textPrimary, flex: 1, lineHeight: 22 },
  placeholder: { color: colors.textTertiary },
  error: { ...typography.label, color: colors.danger },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { maxHeight: '78%', paddingHorizontal: spacing.space5, paddingTop: spacing.space4, borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg, backgroundColor: colors.surface },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.space3 },
  sheetTitle: { ...typography.sectionTitle, color: colors.textPrimary, flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  options: { flexGrow: 0 },
  option: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, padding: spacing.space3, borderBottomWidth: 1, borderBottomColor: colors.border, borderRadius: radius.radiusSm },
  optionSelected: { backgroundColor: colors.surfaceElevated },
  optionText: { ...typography.body, color: colors.textPrimary, flex: 1, lineHeight: 22 },
  optionTextSelected: { color: colors.brandCyan, fontWeight: '600' },
});
