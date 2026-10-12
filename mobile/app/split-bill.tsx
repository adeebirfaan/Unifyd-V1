import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FinanceNumber } from '@/components/FinanceNumber';
import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ConfirmDialog } from '@/components/finance/ConfirmDialog';
import { SettlementBadge } from '@/components/finance/SplitBillRow';
import { categoryIcons } from '@/components/wallet/ExpenseHistoryRow';
import { radius, spacing, typography } from '@/constants/theme';
import { formatExpenseDate, formatRinggit } from '@/lib/expenseHistory';
import { SPLIT_BILL_COLUMNS, isBillSettled, orderParticipants, outstandingCents, sharesMismatch } from '@/lib/splitBills';
import type { ParticipantRecord, SplitBillRecord } from '@/lib/splitBills';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error' | 'notFound';

/** One split bill: who owes what, manual paid/unpaid marking, edit, and delete. */
export default function SplitBillDetailScreen() {
  const { id: idParam, updated } = useLocalSearchParams<{ id?: string; updated?: string }>();
  const id = typeof idParam === 'string' ? idParam : undefined;
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const [state, setState] = useState<LoadState>('loading');
  const [bill, setBill] = useState<SplitBillRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markError, setMarkError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const requestVersion = useRef(0);

  const load = useCallback(async (quiet = false) => {
    const version = ++requestVersion.current;
    if (!quiet) setState('loading');
    if (!userId || !id) { setState(id ? 'error' : 'notFound'); return; }
    try {
      const { data, error } = await supabase.from('split_bills').select(SPLIT_BILL_COLUMNS).eq('id', id).eq('user_id', userId).maybeSingle();
      if (version !== requestVersion.current) return;
      if (error) throw error;
      if (!data) { setBill(null); setState('notFound'); return; }
      setBill(data as SplitBillRecord);
      setState('ready');
    } catch { if (version === requestVersion.current) setState('error'); }
  }, [id, userId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { ++requestVersion.current; };
  }, [load]));

  async function toggleSettled(participant: ParticipantRecord) {
    if (!bill || participant.is_self || busyId) return;
    setBusyId(participant.id);
    setMarkError(false);
    const settling = !participant.is_settled;
    try {
      // Whole shares only: a person is either unpaid or fully settled.
      const { data, error } = await supabase.from('split_bill_participants')
        .update({ is_settled: settling, settled_at: settling ? new Date().toISOString() : null })
        .eq('id', participant.id).eq('split_bill_id', bill.id).select('id').maybeSingle();
      if (error || !data) { setMarkError(true); return; }
      await load(true);
    } catch { setMarkError(true); }
    finally { setBusyId(null); }
  }

  async function confirmDelete() {
    if (!bill || !userId || deleting) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      // Participants are removed with the bill by the database cascade.
      const { data, error } = await supabase.from('split_bills').delete().eq('id', bill.id).eq('user_id', userId).select('id').maybeSingle();
      if (error || !data) { setDeleteError(true); return; }
      setConfirming(false);
      router.dismissTo({ pathname: '/split-bills', params: { deleted: '1' } });
    } catch { setDeleteError(true); }
    finally { setDeleting(false); }
  }

  const card = [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];
  const owed = bill ? outstandingCents(bill.split_bill_participants) : 0;
  const settled = bill ? isBillSettled(bill.split_bill_participants) : false;

  return <Screen>
    <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
    <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('split.eyebrow')}</Text>
    <Text style={[styles.heading, { color: tokens.screenText }]}>{t('split.detailTitle')}</Text>
    {state !== 'ready' || !bill ? <View style={card}>
      {state === 'loading' ? <><ActivityIndicator size="large" color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('split.detailLoading')}</Text></> : <>
        <Ionicons name="alert-circle-outline" size={28} color={tokens.brandCyan} />
        <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{state === 'notFound' ? t('split.notFound') : t('split.detailError')}</Text>
        <View style={styles.fullWidth}><PrimaryButton onPress={() => { void load(); }}>{t('split.retry')}</PrimaryButton></View>
      </>}
    </View> : <>
      {updated === '1' && <View style={[styles.notice, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} accessibilityRole="alert"><Ionicons name="checkmark-circle-outline" size={20} color={tokens.successText} /><Text style={[styles.noticeText, { color: tokens.cardText }]}>{t('split.updated')}</Text></View>}
      <View style={card} testID="split-bill-summary">
        <View style={styles.badgeRow}>
          <SettlementBadge settled={settled} />
          {bill.category && <View style={styles.categoryRow}><Ionicons name={categoryIcons[bill.category]} size={16} color={tokens.brandCyan} /><Text style={[styles.category, { color: tokens.brandCyan }]}>{t(`expense.category.${bill.category}`)}</Text></View>}
        </View>
        <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{bill.title}</Text>
        <FinanceNumber fit style={[styles.amount, { color: tokens.cardText }]}>{formatRinggit(Number(bill.total_amount))}</FinanceNumber>
        <View style={styles.infoRow}><Ionicons name="calendar-outline" size={18} color={tokens.brandCyan} /><Text style={[styles.info, { color: tokens.cardMutedText }]}>{formatExpenseDate(bill.bill_date, language)}</Text></View>
        {bill.notes?.trim() ? <Text style={[styles.notes, { color: tokens.cardText }]}>{bill.notes.trim()}</Text> : null}
        <View style={[styles.divider, { backgroundColor: tokens.border }]} />
        <Text testID="split-bill-outstanding" style={[styles.outstanding, { color: tokens.cardText }]}>{owed > 0 ? t('split.stillOwed', { amount: formatRinggit(owed / 100) }) : t('split.allPaid')}</Text>
        {sharesMismatch(bill) && <View style={styles.infoRow}><Ionicons name="warning-outline" size={18} color={tokens.cardErrorText} /><Text style={[styles.info, { color: tokens.cardErrorText }]}>{t('split.mismatch')}</Text></View>}
      </View>

      <Text style={[styles.sectionTitle, { color: tokens.screenText }]}>{t('split.people')}</Text>
      {markError && <Text style={[styles.error, { color: tokens.errorText }]} accessibilityRole="alert">{t('split.markError')}</Text>}
      <View style={[styles.people, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        {orderParticipants(bill.split_bill_participants).map((participant, index) => {
          const name = participant.is_self ? t('split.you') : participant.participant_name;
          return <View key={participant.id} testID={`split-participant-${participant.is_self ? 'self' : participant.participant_name}`} style={[styles.person, index > 0 && { borderTopWidth: 1, borderTopColor: tokens.border }]}>
            <View style={styles.personTop}>
              <Text style={[styles.personName, { color: tokens.cardText }]} numberOfLines={2}>{name}</Text>
              <FinanceNumber style={[styles.share, { color: tokens.cardText }]}>{formatRinggit(Number(participant.share_amount))}</FinanceNumber>
            </View>
            <View style={styles.status}>
              <Ionicons name={participant.is_settled ? 'checkmark-circle-outline' : 'time-outline'} size={16} color={participant.is_settled ? tokens.successText : tokens.brandCyan} />
              <Text style={[styles.statusText, { color: tokens.cardMutedText }]}>{participant.is_self ? t('split.youPaid') : participant.is_settled ? t('split.paid') : t('split.owes')}</Text>
            </View>
            {!participant.is_self && <Pressable accessibilityRole="button" accessibilityLabel={t(participant.is_settled ? 'split.markUnpaidLabel' : 'split.markPaidLabel', { name })} accessibilityState={{ disabled: !!busyId, busy: busyId === participant.id }} disabled={!!busyId} onPress={() => { void toggleSettled(participant); }} style={[styles.toggle, { borderColor: tokens.border, backgroundColor: tokens.cardElevated }]}>
              {busyId === participant.id ? <ActivityIndicator color={tokens.brandCyan} /> : <Ionicons name={participant.is_settled ? 'arrow-undo-outline' : 'checkmark-done-outline'} size={19} color={tokens.brandCyan} />}
              <Text style={[styles.toggleText, { color: tokens.brandCyan }]}>{t(participant.is_settled ? 'split.markUnpaid' : 'split.markPaid')}</Text>
            </Pressable>}
          </View>;
        })}
      </View>

      <View style={styles.actions}>
        <PrimaryButton onPress={() => router.push({ pathname: '/split-bill-entry', params: { id: bill.id } })}>{t('split.edit')}</PrimaryButton>
        <Pressable accessibilityRole="button" onPress={() => { setDeleteError(false); setConfirming(true); }} style={[styles.deleteButton, { backgroundColor: tokens.destructiveBackground }]}><Ionicons name="trash-outline" size={20} color={tokens.destructiveForeground} /><Text style={[styles.deleteText, { color: tokens.destructiveForeground }]}>{t('split.delete')}</Text></Pressable>
      </View>
      <ConfirmDialog testID="split-delete-dialog" visible={confirming} busy={deleting} destructive error={deleteError ? t('split.deleteError') : null}
        title={t('split.deleteTitle')} body={t('split.deleteBody', { title: bill.title })} confirmLabel={t('split.delete')} cancelLabel={t('split.cancel')}
        onConfirm={() => { void confirmDelete(); }} onCancel={() => { if (!deleting) setConfirming(false); }} />
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space5 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 }, heading: { ...typography.screenTitle, marginBottom: spacing.space6 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, padding: spacing.space3, borderRadius: radius.radiusMd, borderWidth: 1, marginBottom: spacing.space4 },
  noticeText: { ...typography.body, flex: 1, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space3, alignItems: 'flex-start' },
  muted: { ...typography.body }, cardTitle: { ...typography.sectionTitle, lineHeight: 27 }, fullWidth: { width: '100%' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.space3 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space1 }, category: { ...typography.label },
  amount: { ...typography.numeric, fontSize: 34 }, infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }, info: { ...typography.body, flexShrink: 1 },
  notes: { ...typography.body, lineHeight: 23 }, divider: { width: '100%', height: 1 }, outstanding: { ...typography.body, fontWeight: '700' },
  sectionTitle: { ...typography.sectionTitle, marginTop: spacing.space8, marginBottom: spacing.space4 }, error: { ...typography.label, marginBottom: spacing.space3 },
  people: { borderWidth: 1, borderRadius: radius.radiusLg, paddingHorizontal: spacing.space5 },
  person: { paddingVertical: spacing.space4, gap: spacing.space2 },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 }, personName: { ...typography.body, fontWeight: '700', flex: 1 }, share: { ...typography.numeric, fontSize: 18 },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }, statusText: { ...typography.label },
  toggle: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingHorizontal: spacing.space3, borderWidth: 1, borderRadius: radius.radiusMd, marginTop: spacing.space1 },
  toggleText: { ...typography.body, fontWeight: '600' },
  actions: { gap: spacing.space3, marginTop: spacing.space6 },
  deleteButton: { minHeight: 54, borderRadius: radius.radiusMd, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2, paddingHorizontal: spacing.space4 }, deleteText: { ...typography.body, fontWeight: '700' },
});
