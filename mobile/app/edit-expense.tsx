import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ExpenseForm } from '@/components/wallet/ExpenseForm';
import { radius, spacing, typography } from '@/constants/theme';
import { useExpenseRecord } from '@/hooks/useExpenseRecord';
import type { ExpenseInput } from '@/lib/expenseForm';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export default function EditExpenseScreen() {
  const { id, budgetPeriod } = useLocalSearchParams<{ id?: string; budgetPeriod?: string }>();
  const { state, expense, reload } = useExpenseRecord(typeof id === 'string' ? id : undefined);
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  async function save(input: ExpenseInput): Promise<boolean> {
    if (!expense || !session) return false;
    try {
      const { data, error } = await supabase.from('expenses')
        .update(input)
        .eq('id', expense.id)
        .eq('user_id', session.user.id)
        .select('id')
        .maybeSingle();
      if (error || !data) return false;
      router.replace({ pathname: '/(tabs)/wallet', params: { updated: '1', budgetPeriod: budgetPeriod === 'weekly' ? 'weekly' : 'monthly' } });
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
        <Text style={[styles.title, { color: tokens.screenText }]}>{t('expense.edit')}</Text>
        <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('expense.editSubtitle')}</Text>
        {state === 'ready' && expense ? <ExpenseForm
          key={expense.id}
          initial={{ title: expense.title, amount: Number(expense.amount).toFixed(2), category: expense.category, expenseDate: expense.expense_date, notes: expense.notes ?? '' }}
          onSave={save}
          submitKey="expense.editSave"
          savingKey="expense.editSaving"
          errorKey="expense.editError"
        /> : <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          {state === 'loading' && <ActivityIndicator size="large" color={tokens.brandCyan} />}
          <Text style={[styles.message, { color: tokens.cardMutedText }]}>{state === 'loading' ? t('expense.editLoading') : state === 'notFound' ? t('expense.notFound') : t('expense.detailError')}</Text>
          {state !== 'loading' && <PrimaryButton onPress={() => { void reload(); }}>{t('wallet.retry')}</PrimaryButton>}
        </View>}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: spacing.space6 }, inner: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space5 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 }, title: { ...typography.screenTitle, marginBottom: spacing.space2 }, helper: { ...typography.body, lineHeight: 23, marginBottom: spacing.space6 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space4 }, message: { ...typography.body, lineHeight: 23 },
});
