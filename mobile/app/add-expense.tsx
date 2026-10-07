import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExpenseForm } from '@/components/wallet/ExpenseForm';
import { spacing, typography } from '@/constants/theme';
import type { ExpenseInput } from '@/lib/expenseForm';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export default function AddExpenseScreen() {
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  async function save(input: ExpenseInput): Promise<boolean> {
    if (!session) return false;
    try {
      const { error } = await supabase.from('expenses').insert({ user_id: session.user.id, ...input });
      if (error) return false;
      router.replace({ pathname: '/(tabs)/wallet', params: { saved: '1' } });
      return true;
    } catch {
      return false;
    }
  }

  return <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.fill} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
        <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('wallet.eyebrow')}</Text>
        <Text style={[styles.title, { color: tokens.screenText }]}>{t('wallet.add')}</Text>
        <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('expense.helper')}</Text>
        <ExpenseForm onSave={save} submitKey="expense.save" savingKey="expense.saving" errorKey="expense.saveError" />
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: spacing.space6 }, inner: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space5 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 },
  title: { ...typography.screenTitle, marginBottom: spacing.space2 }, helper: { ...typography.body, lineHeight: 23, marginBottom: spacing.space6 },
});
