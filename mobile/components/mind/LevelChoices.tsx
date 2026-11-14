import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/constants/theme';
import type { CheckInLevel } from '@/lib/moodEntries';
import { useAppearance } from '@/providers/AppearanceProvider';

type Choice = { value: CheckInLevel; label: string; icon: keyof typeof Ionicons.glyphMap };

// One compact row of five icons (Mind revamp, 2026-11-15). Only the chosen word is shown, beside the label,
// so the form stays short; every icon keeps its full accessible name ("Mood: Good").
export function LevelChoices({ label, choices, selected, onSelect, error, disabled = false }: {
  label: string;
  choices: Choice[];
  selected: CheckInLevel | null;
  onSelect: (value: CheckInLevel) => void;
  error?: string;
  disabled?: boolean;
}) {
  const { tokens } = useAppearance();
  const chosen = choices.find((choice) => choice.value === selected);
  return <View style={styles.group}>
    <View style={styles.header}>
      <Text style={[styles.label, { color: tokens.cardMutedText }]}>{label}</Text>
      {chosen && <Text style={[styles.chosen, { color: tokens.brandCyan }]}>{chosen.label}</Text>}
    </View>
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
        <Ionicons name={choice.icon} size={26} color={active ? tokens.brandCyan : tokens.cardMutedText} />
      </Pressable>;
    })}</View>
    {error && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: spacing.space3 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.space3 },
  label: { ...typography.label },
  chosen: { ...typography.label, fontWeight: '700' },
  choices: { flexDirection: 'row', gap: spacing.space2 },
  choice: { flex: 1, minHeight: 56, borderWidth: 1.5, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.label },
  disabled: { opacity: 0.65 },
});
