import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/constants/theme';
import type { CheckInLevel } from '@/lib/moodEntries';
import { useAppearance } from '@/providers/AppearanceProvider';

type Choice = { value: CheckInLevel; label: string; icon: keyof typeof Ionicons.glyphMap };

export function LevelChoices({ label, choices, selected, onSelect, error, disabled = false }: {
  label: string;
  choices: Choice[];
  selected: CheckInLevel | null;
  onSelect: (value: CheckInLevel) => void;
  error?: string;
  disabled?: boolean;
}) {
  const { tokens } = useAppearance();
  return <View style={styles.group}>
    <Text style={[styles.label, { color: tokens.cardText }]}>{label}</Text>
    <View style={styles.choices}>{choices.map((choice) => {
      const active = choice.value === selected;
      return <Pressable
        key={choice.value}
        accessibilityRole="radio"
        accessibilityLabel={`${label}: ${choice.label}`}
        accessibilityState={{ checked: active, disabled }}
        aria-checked={active}
        disabled={disabled}
        onPress={() => onSelect(choice.value)}
        style={[styles.choice, { backgroundColor: tokens.cardElevated, borderColor: active ? tokens.brandCyan : tokens.border }, disabled && styles.disabled]}
      >
        <Ionicons name={choice.icon} size={22} color={active ? tokens.brandCyan : tokens.cardMutedText} />
        <Text style={[styles.choiceLabel, { color: tokens.cardText }]}>{choice.label}</Text>
      </Pressable>;
    })}</View>
    {error && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: spacing.space3 },
  label: { ...typography.label },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2 },
  choice: { width: '48%', flexGrow: 1, minHeight: 58, borderWidth: 1, borderRadius: radius.radiusMd, flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingHorizontal: spacing.space3 },
  choiceLabel: { ...typography.label, flexShrink: 1 },
  error: { ...typography.label },
  disabled: { opacity: 0.65 },
});
