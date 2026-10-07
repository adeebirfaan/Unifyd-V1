import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ExpenseHistoryRow } from '@/components/wallet/ExpenseHistoryRow';
import { radius, spacing, typography } from '@/constants/theme';
import { expenseTotalCents, formatRinggit } from '@/lib/expenseHistory';
import type { ExpenseRecord } from '@/lib/expenseHistory';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type WalletState = 'loading' | 'ready' | 'error';
const PAGE_SIZE = 500;

export default function WalletScreen() {
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { saved, updated, deleted } = useLocalSearchParams<{ saved?: string; updated?: string; deleted?: string }>();
  const userId = session?.user.id;
  const [state, setState] = useState<WalletState>('loading');
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const requestVersion = useRef(0);

  const loadWallet = useCallback(async (kind: 'initial' | 'refresh' = 'initial') => {
    const version = ++requestVersion.current;
    if (kind === 'refresh') setRefreshing(true);
    else setState('loading');
    if (!userId) {
      setState('error');
      setRefreshing(false);
      return;
    }
    try {
      const loaded: ExpenseRecord[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase.from('expenses')
          .select('id,title,amount,category,expense_date,notes,created_at')
          .eq('user_id', userId)
          .order('expense_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        if (version !== requestVersion.current) return;
        if (error) throw error;
        const page = (data ?? []) as ExpenseRecord[];
        loaded.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      setExpenses(loaded);
      setState('ready');
    } catch {
      if (version === requestVersion.current) {
        setExpenses([]);
        setState('error');
      }
    } finally {
      if (version === requestVersion.current) setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void loadWallet();
    return () => { ++requestVersion.current; };
  }, [loadWallet]));

  const hasExpenses = state === 'ready' && expenses.length > 0;
  const total = formatRinggit(expenseTotalCents(expenses) / 100);

  return <FlatList
    style={{ backgroundColor: tokens.screenBackground }}
    contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space6 }]}
    data={hasExpenses ? expenses : []}
    keyExtractor={(expense) => expense.id}
    renderItem={({ item }) => <ExpenseHistoryRow expense={item} onPress={() => router.push({ pathname: '/expense-detail', params: { id: item.id } })} />}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadWallet('refresh'); }} tintColor={tokens.brandCyan} colors={[tokens.brandCyan]} accessibilityLabel={t('wallet.refreshing')} />}
    ListHeaderComponent={<>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('wallet.eyebrow')}</Text>
      <Text style={[styles.title, { color: tokens.screenText }]}>{t('tab.wallet')}</Text>
      {state === 'ready' && (saved === '1' || updated === '1' || deleted === '1') && <View style={[styles.success, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Ionicons name="checkmark-circle-outline" size={20} color={tokens.successText} /><Text style={[styles.successText, { color: tokens.cardText }]}>{deleted === '1' ? t('wallet.deleted') : updated === '1' ? t('wallet.updated') : t('wallet.saved')}</Text></View>}
      {hasExpenses && <>
        <View style={[styles.summary, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <Text style={[styles.summaryEyebrow, { color: tokens.brandCyan }]}>{t('wallet.totalSpent')}</Text>
          <Text style={[styles.total, { color: tokens.cardText }]}>{total}</Text>
          <Text style={[styles.count, { color: tokens.cardMutedText }]}>{expenses.length === 1 ? t('wallet.oneRecorded') : t('wallet.manyRecorded', { count: expenses.length })}</Text>
        </View>
        <Text style={[styles.sectionTitle, { color: tokens.screenText }]}>{t('wallet.recent')}</Text>
      </>}
    </>}
    ListEmptyComponent={state === 'loading'
      ? <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><ActivityIndicator size="large" color={tokens.brandCyan} accessibilityLabel={t('wallet.loading')} /><Text style={[styles.description, { color: tokens.cardMutedText }]}>{t('wallet.loading')}</Text></View>
      : <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: tokens.cardElevated }]}><Ionicons name={state === 'error' ? 'alert-circle-outline' : 'wallet-outline'} size={28} color={tokens.brandCyan} /></View>
          <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{state === 'error' ? t('wallet.loadError') : t('wallet.emptyTitle')}</Text>
          {state === 'ready' && <Text style={[styles.description, { color: tokens.cardMutedText }]}>{t('wallet.emptyBody')}</Text>}
          <View style={styles.action}>{state === 'error'
            ? <Pressable accessibilityRole="button" onPress={() => { void loadWallet(); }} style={styles.retry}><Text style={[styles.retryText, { color: tokens.brandCyan }]}>{t('wallet.retry')}</Text></Pressable>
            : <PrimaryButton onPress={() => router.push('/add-expense')}>{t('wallet.add')}</PrimaryButton>}
          </View>
        </View>}
    ListFooterComponent={hasExpenses ? <View style={styles.footer}><PrimaryButton onPress={() => router.push('/add-expense')}>{t('wallet.add')}</PrimaryButton></View> : null}
  />;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.space6, paddingBottom: 112 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 }, title: { ...typography.screenTitle, marginBottom: spacing.space6 },
  success: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, padding: spacing.space3, borderRadius: radius.radiusMd, borderWidth: 1, marginBottom: spacing.space4 },
  successText: { ...typography.body },
  summary: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space2 },
  summaryEyebrow: { ...typography.label, letterSpacing: 2 }, total: { ...typography.numeric, fontSize: 36 }, count: { ...typography.body },
  sectionTitle: { ...typography.sectionTitle, marginTop: spacing.space8, marginBottom: spacing.space4 },
  card: { minHeight: 250, alignItems: 'flex-start', borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space3 },
  iconWrap: { width: 56, height: 56, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.space2 },
  cardTitle: { ...typography.sectionTitle }, description: { ...typography.body, lineHeight: 23 }, action: { width: '100%', marginTop: spacing.space3 },
  retry: { minHeight: 44, justifyContent: 'center' }, retryText: { ...typography.body, fontWeight: '600' }, footer: { marginTop: spacing.space3 },
});
