import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type Props = Pick<TextInputProps, 'autoCapitalize' | 'autoComplete' | 'keyboardType' | 'textContentType' | 'returnKeyType'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secure?: boolean;
  error?: string;
};

export function FormField({ label, value, onChangeText, placeholder, secure = false, error, ...inputProps }: Props) {
  const [visible, setVisible] = useState(false);
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: tokens.screenText }]}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputError : null]}>
        <TextInput
          {...inputProps}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.brandCyan}
          secureTextEntry={secure && !visible}
          style={styles.input}
          accessibilityLabel={label}
        />
        {secure && (
          <Pressable onPress={() => setVisible(!visible)} accessibilityRole="button" accessibilityLabel={visible ? t('common.hidePassword') : t('common.showPassword')} style={styles.eye}>
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {error && <Text style={[styles.error, { color: tokens.errorText }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.space2 },
  label: { ...typography.label, color: colors.textPrimary },
  inputWrap: { minHeight: 54, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radius.radiusMd, borderWidth: 1, borderColor: colors.border },
  inputError: { borderColor: colors.danger },
  input: { flex: 1, minHeight: 52, paddingHorizontal: spacing.space4, color: colors.textPrimary, ...typography.body },
  eye: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.label, color: colors.danger },
});
