import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { FinanceNumber } from '@/components/FinanceNumber';
import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { SplitBillRow } from '@/components/finance/SplitBillRow';
import { radius, spacing, typography } from '@/constants/theme';
import { formatRinggit } from '@/lib/expenseHistory';
import { SPLIT_BILL_COLUMNS, isBillSettled, totalOutstandingCents } from '@/lib/splitBills';
import type { SplitBillRecord } from '@/lib/splitBills';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error';
const PAGE_SIZE = 500;

/** The student's private split-bill tracker: what others still owe them, open bills first. */
export default function SplitBillsScreen() {
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const { saved, deleted } = useLocalSearchParams<{ saved?: string; deleted?: string }>();
  const userId = session?.user.id;
  const [state, setState] = useState<LoadState>('loading');
  const [bills, setBills] = useState<SplitBillRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const requestVersion = useRef(0);

  const load = useCallback(async (kind: 'initial' | 'refresh' = 'initial') => {
    const version = ++requestVersion.current;
    if (kind === 'refresh') setRefreshing(true);
    else setState('loading');
    if (!userId) { setState('error'); setRefreshing(false); return; }
    try {
      const loaded: SplitBillRecord[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase.from('split_bills').select(SPLIT_BILL_COLUMNS)
          .eq('user_id', userId)
          .order('bill_date', { ascending: false }).order('id', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        if (version !== requestVersion.current) return;
        if (error) throw error;
        const page = (data ?? []) as SplitBillRecord[];
        loaded.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      setBills(loaded);
      setState('ready');
    } catch {
      if (version === requestVersion.current) { setBills([]); setState('error'); }
    } finally {
      if (version === requestVersion.current) setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { ++requestVersion.current; };
  }, [load]));

  const open = bills.filter((bill) => !isBillSettled(bill.split_bill_participants));
  const settled = bills.filter((bill) => isBillSettled(bill.split_bill_participants));
  const owed = totalOutstandingCents(bills);
  const feedback = deleted === '1' ? t('split.deleted') : saved === '1' ? t('split.saved') : null;
  const card = [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];
  const openBill = (bill: SplitBillRecord) => router.push({ pathname: '/split-bill', params: { id: bill.id } });

  return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load('refresh'); }} tintColor={tokens.brandCyan} colors={[tokens.brandCyan]} accessibilityLabel={t('split.refreshing')} />}>
    <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
    <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('split.eyebrow')}</Text>
    <Text style={[styles.title, { color: tokens.screenText }]}>{t('split.title')}</Text>
    <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('split.helper')}</Text>
    {feedback && state === 'ready' && <View style={[styles.notice, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} accessibilityRole="alert"><Ionicons name="checkmark-circle-outline" size={20} color={tokens.successText} /><Text style={[styles.noticeText, { color: tokens.cardText }]}>{feedback}</Text></View>}

    {state === 'loading' ? <View style={card}><ActivityIndicator size="large" color={tokens.brandCyan} accessibilityLabel={t('split.loading')} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('split.loading')}</Text></View>
      : state === 'error' ? <View style={card}>
        <View style={[styles.iconWrap, { backgroundColor: tokens.cardElevated }]}><Ionicons name="alert-circle-outline" size={28} color={tokens.brandCyan} /></View>
        <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('split.loadError')}</Text>
        <View style={styles.fullWidth}><PrimaryButton onPress={() => { void load(); }}>{t('split.retry')}</PrimaryButton></View>
      </View>
        : !bills.length ? <View style={card} testID="split-bills-empty">
          <View style={[styles.iconWrap, { backgroundColor: tokens.cardElevated }]}><Ionicons name="people-outline" size={28} color={tokens.brandCyan} /></View>
          <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('split.emptyTitle')}</Text>
          <Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('split.emptyBody')}</Text>
          <View style={styles.fullWidth}><PrimaryButton onPress={() => router.push('/split-bill-entry')}>{t('split.createFirst')}</PrimaryButton></View>
        </View>
          : <>
            <View style={[styles.summary, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} testID="split-bills-summary">
              <Text style={[styles.summaryEyebrow, { color: tokens.brandCyan }]}>{t('split.owedEyebrow')}</Text>
              <FinanceNumber fit style={[styles.total, { color: tokens.cardText }]}>{formatRinggit(owed / 100)}</FinanceNumber>
              <Text style={[styles.count, { color: tokens.cardText }]}>{open.length === 0 ? t('split.openNone') : open.length === 1 ? t('split.openOne') : t('split.openMany', { count: open.length })}</Text>
            </View>
            <PrimaryButton onPress={() => router.push('/split-bill-entry')}>{t('split.create')}</PrimaryButton>
            {open.length > 0 && <><Text style={[styles.sectionTitle, { color: tokens.screenText }]}>{t('split.openSection')}</Text>{open.map((bill) => <SplitBillRow key={bill.id} bill={bill} onPress={() => openBill(bill)} />)}</>}
            {settled.length > 0 && <><Text style={[styles.sectionTitle, { color: tokens.screenText }]}>{t('split.settledSection')}</Text>{settled.map((bill) => <SplitBillRow key={bill.id} bill={bill} onPress={() => openBill(bill)} />)}</>}
          </>}
  </Screen>;
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space5 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 }, title: { ...typography.screenTitle, marginBottom: spacing.space2 },
  helper: { ...typography.body, lineHeight: 23, marginBottom: spacing.space6 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, padding: spacing.space3, borderRadius: radius.radiusMd, borderWidth: 1, marginBottom: spacing.space4 },
  noticeText: { ...typography.body, flex: 1, lineHeight: 22 },
  card: { minHeight: 220, alignItems: 'flex-start', borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space3 },
  iconWrap: { width: 56, height: 56, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.space2 },
  cardTitle: { ...typography.sectionTitle }, muted: { ...typography.body, lineHeight: 23 }, fullWidth: { width: '100%', marginTop: spacing.space3 },
  summary: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space2, marginBottom: spacing.space4 },
  summaryEyebrow: { ...typography.label, letterSpacing: 2 }, total: { ...typography.numeric, fontSize: 36 }, count: { ...typography.body },
  sectionTitle: { ...typography.sectionTitle, marginTop: spacing.space8, marginBottom: spacing.space4 },
});
