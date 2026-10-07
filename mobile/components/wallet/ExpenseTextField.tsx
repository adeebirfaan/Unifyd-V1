import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';

type Props = Pick<TextInputProps, 'keyboardType' | 'autoCapitalize' | 'multiline' | 'maxLength'> & {
  label: string; value: string; onChangeText: (text: string) => void; placeholder: string; error?: string; prefix?: string;
};

export function ExpenseTextField({ label, value, onChangeText, placeholder, error, prefix, multiline, ...inputProps }: Props) {
  const { tokens } = useAppearance();
  return <View style={styles.field}>
    <Text style={[styles.label, { color: tokens.cardText }]}>{label}</Text>
    <View style={[styles.control, { backgroundColor: tokens.cardElevated, borderColor: error ? tokens.cardErrorText : tokens.border }, multiline && styles.multilineControl]}>
      {prefix && <Text style={[styles.prefix, { color: tokens.cardText }]}>{prefix}</Text>}
      <TextInput {...inputProps} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={tokens.cardMutedText} selectionColor={tokens.brandCyan} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} accessibilityLabel={label} style={[styles.input, { color: tokens.cardText }, multiline && styles.multilineInput]} />
    </View>
    {error && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: spacing.space2 }, label: { ...typography.label },
  control: { minHeight: 54, borderRadius: radius.radiusMd, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.space4 },
  multilineControl: { minHeight: 108, alignItems: 'flex-start' },
  input: { ...typography.body, flex: 1, minHeight: 52, paddingVertical: spacing.space3 }, multilineInput: { minHeight: 106 },
  prefix: { ...typography.body, fontWeight: '700', marginRight: spacing.space2 }, error: { ...typography.label },
});
