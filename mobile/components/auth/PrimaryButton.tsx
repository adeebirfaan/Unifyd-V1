import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';

export function PrimaryButton({ children, onPress, loading = false, disabled = false }: {
  children: ReactNode;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { tokens } = useAppearance();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, { borderColor: tokens.primaryButtonBorder, borderWidth: tokens.primaryButtonBorderWidth }, (pressed || disabled || loading) && styles.dimmed]}
    >
      {loading ? <ActivityIndicator color={colors.black} /> : <Text style={styles.label}>{children}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 54, paddingHorizontal: spacing.space5, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  dimmed: { opacity: 0.7 },
  label: { ...typography.body, fontWeight: '700', color: colors.background },
});
