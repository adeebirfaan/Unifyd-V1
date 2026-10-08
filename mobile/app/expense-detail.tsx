import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { categoryIcons } from '@/components/wallet/ExpenseHistoryRow';
import { radius, spacing, typography } from '@/constants/theme';
import { useExpenseRecord } from '@/hooks/useExpenseRecord';
import { formatExpenseDate, formatRinggit } from '@/lib/expenseHistory';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export default function ExpenseDetailScreen() {
  const { id, budgetPeriod } = useLocalSearchParams<{ id?: string; budgetPeriod?: string }>();
  const { state, expense, reload } = useExpenseRecord(typeof id === 'string' ? id : undefined);
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  async function confirmDelete() {
    if (deleting) return;
    if (!expense || !session) {
      setDeleteError(true);
      return;
    }
    setDeleting(true);
    setDeleteError(false);
    try {
      const { data, error } = await supabase.from('expenses')
        .delete()
        .eq('id', expense.id)
        .eq('user_id', session.user.id)
        .select('id')
        .maybeSingle();
      if (error || !data) {
        setDeleteError(true);
        return;
      }
      setConfirmVisible(false);
      router.replace({ pathname: '/(tabs)/wallet', params: { deleted: '1', budgetPeriod: budgetPeriod === 'weekly' ? 'weekly' : 'monthly' } });
    } catch {
      setDeleteError(true);
    } finally {
      setDeleting(false);
    }
  }

  const amount = expense ? formatRinggit(Number(expense.amount)) : '';
  const date = expense ? formatExpenseDate(expense.expense_date, language) : '';

  return <Screen>
    <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
    <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('wallet.eyebrow')}</Text>
    <Text style={[styles.heading, { color: tokens.screenText }]}>{t('expense.detailTitle')}</Text>
    {state !== 'ready' || !expense ? <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
      {state === 'loading' ? <><ActivityIndicator size="large" color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('expense.detailLoading')}</Text></> : <>
        <Ionicons name="alert-circle-outline" size={28} color={tokens.brandCyan} />
        <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{state === 'notFound' ? t('expense.notFound') : t('expense.detailError')}</Text>
        <View style={styles.fullWidth}><PrimaryButton onPress={() => { void reload(); }}>{t('wallet.retry')}</PrimaryButton></View>
      </>}
    </View> : <>
      <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <View style={styles.categoryRow}>
          <View style={[styles.iconWrap, { backgroundColor: tokens.cardElevated }]}><Ionicons name={categoryIcons[expense.category]} size={25} color={tokens.brandCyan} /></View>
          <Text style={[styles.category, { color: tokens.brandCyan }]}>{t(`expense.category.${expense.category}`)}</Text>
        </View>
        <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{expense.title}</Text>
        <Text style={[styles.amount, { color: tokens.cardText }]}>{amount}</Text>
        <View style={[styles.divider, { backgroundColor: tokens.border }]} />
        <View style={styles.infoRow}><Ionicons name="calendar-outline" size={20} color={tokens.brandCyan} /><Text style={[styles.infoText, { color: tokens.cardMutedText }]}>{date}</Text></View>
        {expense.notes?.trim() ? <View style={styles.notes}><Text style={[styles.label, { color: tokens.cardMutedText }]}>{t('expense.detailNotes')}</Text><Text style={[styles.noteText, { color: tokens.cardText }]}>{expense.notes.trim()}</Text></View> : null}
        <Text style={[styles.source, { color: tokens.cardMutedText }]}>{expense.entry_source === 'ocr' ? t('expense.sourceOcr') : t('expense.sourceManual')}</Text>
      </View>
      <View style={styles.actions}>
        <PrimaryButton onPress={() => router.push({ pathname: '/edit-expense', params: { id: expense.id, budgetPeriod: budgetPeriod === 'weekly' ? 'weekly' : 'monthly' } })}>{t('expense.edit')}</PrimaryButton>
        <Pressable accessibilityRole="button" onPress={() => { setDeleteError(false); setConfirmVisible(true); }} style={[styles.deleteButton, { backgroundColor: tokens.destructiveBackground }]}><Ionicons name="trash-outline" size={20} color={tokens.destructiveForeground} /><Text style={[styles.deleteText, { color: tokens.destructiveForeground }]}>{t('expense.delete')}</Text></Pressable>
      </View>
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => { if (!deleting) setConfirmVisible(false); }}>
        <View style={styles.modalRoot}>
          <Pressable style={[styles.scrim, { backgroundColor: tokens.modalScrim }]} disabled={deleting} onPress={() => setConfirmVisible(false)} accessibilityLabel={t('expense.cancel')} />
          <View style={[styles.dialog, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} accessibilityViewIsModal>
            <Text style={[styles.dialogTitle, { color: tokens.cardText }]}>{t('expense.deleteConfirmTitle')}</Text>
            <Text style={[styles.dialogBody, { color: tokens.cardMutedText }]}>{t('expense.deleteConfirmBody', { title: expense.title, amount })}</Text>
            {deleteError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t('expense.deleteError')}</Text>}
            <View style={styles.dialogActions}>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: deleting }} disabled={deleting} onPress={() => setConfirmVisible(false)} style={[styles.dialogButton, { borderColor: tokens.border, borderWidth: 1, backgroundColor: tokens.cardElevated }]}><Text style={[styles.dialogButtonText, { color: tokens.cardText }]}>{t('expense.cancel')}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: deleting, busy: deleting }} disabled={deleting} onPress={() => { void confirmDelete(); }} style={[styles.dialogButton, { backgroundColor: tokens.destructiveBackground }]}>{deleting ? <ActivityIndicator color={tokens.destructiveForeground} /> : <Text style={[styles.dialogButtonText, { color: tokens.destructiveForeground }]}>{t('expense.delete')}</Text>}</Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space5 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 }, heading: { ...typography.screenTitle, marginBottom: spacing.space6 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space4, alignItems: 'flex-start' },
  muted: { ...typography.body }, cardTitle: { ...typography.sectionTitle, lineHeight: 27 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 }, iconWrap: { width: 52, height: 52, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center' }, category: { ...typography.label },
  amount: { ...typography.numeric, fontSize: 34 }, divider: { width: '100%', height: 1 }, infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 }, infoText: { ...typography.body },
  notes: { gap: spacing.space2 }, label: { ...typography.label }, noteText: { ...typography.body, lineHeight: 23 }, source: { ...typography.label, marginTop: spacing.space2 },
  actions: { gap: spacing.space3, marginTop: spacing.space6 }, fullWidth: { width: '100%' },
  deleteButton: { minHeight: 54, borderRadius: radius.radiusMd, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2, paddingHorizontal: spacing.space4 }, deleteText: { ...typography.body, fontWeight: '700' },
  modalRoot: { flex: 1, justifyContent: 'center', padding: spacing.space5 }, scrim: { ...StyleSheet.absoluteFill },
  dialog: { width: '100%', maxWidth: 420, alignSelf: 'center', borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space4 },
  dialogTitle: { ...typography.sectionTitle }, dialogBody: { ...typography.body, lineHeight: 23 }, error: { ...typography.label, lineHeight: 20 },
  dialogActions: { flexDirection: 'row', gap: spacing.space3 }, dialogButton: { flex: 1, minHeight: 50, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.space2 }, dialogButtonText: { ...typography.body, fontWeight: '700' },
});
