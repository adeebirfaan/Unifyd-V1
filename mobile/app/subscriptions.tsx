import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AnimatedMoneyAmount } from '@/components/AnimatedMoneyAmount';
import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { SubscriptionDetailsSheet } from '@/components/finance/SubscriptionDetailsSheet';
import type { SheetConfirm } from '@/components/finance/SubscriptionDetailsSheet';
import { SubscriptionListItem } from '@/components/finance/SubscriptionListItem';
import { radius, spacing, typography } from '@/constants/theme';
import { localDateISO } from '@/lib/expenseForm';
import { formatExpenseDate, formatRinggit } from '@/lib/expenseHistory';
import { refreshSubscriptionReminder } from '@/lib/subscriptionReminders';
import type { SubscriptionReminderIssue } from '@/lib/subscriptionReminders';
import { SUBSCRIPTION_COLUMNS, advanceBillingDate, attentionSubscriptions, monthlyEquivalentCents, renewalStatus, sortSubscriptions } from '@/lib/subscriptions';
import type { SubscriptionRecord } from '@/lib/subscriptions';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error';
type Feedback = { kind: 'success' | 'error'; text: string } | null;
const PAGE_SIZE = 500;

export default function SubscriptionsScreen() {
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const { saved, updated, deleted, reminderIssue } = useLocalSearchParams<{ saved?: string; updated?: string; deleted?: string; reminderIssue?: string }>();
  const userId = session?.user.id;
  const [state, setState] = useState<LoadState>('loading');
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [localIssue, setLocalIssue] = useState<SubscriptionReminderIssue | null>(null);
  const [renewing, setRenewing] = useState<SubscriptionRecord | null>(null);
  const [renewBusy, setRenewBusy] = useState(false);
  const [renewError, setRenewError] = useState(false);
  const [deleting, setDeleting] = useState<SubscriptionRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pausedOpen, setPausedOpen] = useState(false);
  const requestVersion = useRef(0);
  const today = localDateISO();

  const load = useCallback(async (kind: 'initial' | 'refresh' | 'quiet' = 'initial') => {
    const version = ++requestVersion.current;
    if (kind === 'refresh') setRefreshing(true);
    else if (kind === 'initial') setState('loading');
    if (!userId) { setState('error'); setRefreshing(false); return; }
    try {
      const loaded: SubscriptionRecord[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase.from('subscriptions')
          .select(SUBSCRIPTION_COLUMNS)
          .eq('user_id', userId)
          .order('next_billing_date', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (version !== requestVersion.current) return;
        if (error) throw error;
        const page = (data ?? []) as SubscriptionRecord[];
        loaded.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      setSubscriptions(sortSubscriptions(loaded));
      setState('ready');
    } catch {
      if (version === requestVersion.current) { setSubscriptions([]); setState('error'); }
    } finally {
      if (version === requestVersion.current) setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    // Notices from an earlier visit give way to the result the returning screen passed in.
    setFeedback(null);
    setLocalIssue(null);
    void load();
    return () => { ++requestVersion.current; };
  }, [load]));

  async function toggleActive(subscription: SubscriptionRecord) {
    if (!userId || busyId) return;
    setBusyId(subscription.id);
    setFeedback(null);
    setLocalIssue(null);
    const resuming = !subscription.is_active;
    try {
      const { data, error } = await supabase.from('subscriptions').update({ is_active: resuming })
        .eq('id', subscription.id).eq('user_id', userId).select('id').maybeSingle();
      if (error || !data) { setFeedback({ kind: 'error', text: t('subscription.statusError') }); return; }
      setLocalIssue(await refreshSubscriptionReminder(userId, language, { ...subscription, is_active: resuming }));
      setFeedback({ kind: 'success', text: t(resuming ? 'subscription.resumedFeedback' : 'subscription.pausedFeedback') });
      await load('quiet');
    } catch { setFeedback({ kind: 'error', text: t('subscription.statusError') }); }
    finally { setBusyId(null); }
  }

  async function confirmRenew() {
    const subscription = renewing;
    if (!subscription || !userId || renewBusy) return;
    const next = advanceBillingDate(subscription.next_billing_date, subscription.billing_frequency);
    if (!next) { setRenewError(true); return; }
    setRenewBusy(true);
    setRenewError(false);
    try {
      // Only the date moves; the amount and reminder preferences stay as saved. No expense is created.
      const { data, error } = await supabase.from('subscriptions').update({ next_billing_date: next })
        .eq('id', subscription.id).eq('user_id', userId).select('id').maybeSingle();
      if (error || !data) { setRenewError(true); return; }
      setRenewing(null);
      setFeedback({ kind: 'success', text: t('subscription.renewed', { date: formatExpenseDate(next, language) }) });
      setLocalIssue(await refreshSubscriptionReminder(userId, language, { ...subscription, next_billing_date: next }));
      await load('quiet');
    } catch { setRenewError(true); }
    finally { setRenewBusy(false); }
  }

  async function confirmDelete() {
    const subscription = deleting;
    if (!subscription || !userId || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(false);
    try {
      const { data, error } = await supabase.from('subscriptions').delete()
        .eq('id', subscription.id).eq('user_id', userId).select('id').maybeSingle();
      if (error || !data) { setDeleteError(true); return; }
      setDeleting(null);
      setSelectedId(null);
      setFeedback({ kind: 'success', text: t('subscription.deleted') });
      // Cancels the deleted plan's local reminder.
      await refreshSubscriptionReminder(userId, language, null);
      await load('quiet');
    } catch { setDeleteError(true); }
    finally { setDeleteBusy(false); }
  }

  const issue = localIssue ?? (reminderIssue as SubscriptionReminderIssue | undefined) ?? '';
  const issueText = issue === 'permissionDenied' ? t('subscription.reminderPermission') : issue === 'unsupported' ? t('subscription.reminderWeb')
    : issue === 'past' ? t('subscription.reminderPast') : issue === 'error' ? t('subscription.reminderUnavailable') : null;
  const routeFeedback = feedback ? null : deleted === '1' ? t('subscription.deleted') : updated === '1' ? t('subscription.updated') : saved === '1' ? t('subscription.saved') : null;
  const active = subscriptions.filter((subscription) => subscription.is_active);
  const paused = subscriptions.filter((subscription) => !subscription.is_active);
  const attention = attentionSubscriptions(subscriptions, today);
  const monthlyCents = monthlyEquivalentCents(subscriptions);
  const selected = subscriptions.find((subscription) => subscription.id === selectedId) ?? null;
  const confirm: SheetConfirm = renewing ? {
    kind: 'renew', busy: renewBusy, error: renewError ? t('subscription.renewError') : null, confirmLabel: t('subscription.markRenewed'),
    title: t('subscription.renewTitle', { name: renewing.name }),
    body: t('subscription.renewBody', { from: formatExpenseDate(renewing.next_billing_date, language), to: formatExpenseDate(advanceBillingDate(renewing.next_billing_date, renewing.billing_frequency) ?? renewing.next_billing_date, language) }),
  } : deleting ? {
    kind: 'delete', busy: deleteBusy, error: deleteError ? t('subscription.deleteError') : null, confirmLabel: t('subscription.delete'),
    title: t('subscription.deleteTitle'), body: t('subscription.deleteBody', { name: deleting.name }),
  } : null;
  const card = [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];
  const openDetails = (subscription: SubscriptionRecord) => { setRenewing(null); setDeleting(null); setSelectedId(subscription.id); };
  const closeDetails = () => { if (renewBusy || deleteBusy) return; setRenewing(null); setDeleting(null); setSelectedId(null); };
  const addSubscription = () => router.push('/subscription-entry');
  const rows = (list: readonly SubscriptionRecord[], testIDPrefix?: string) => list.map((subscription, index) => <SubscriptionListItem key={subscription.id} subscription={subscription}
    status={renewalStatus(subscription.next_billing_date, subscription.reminder_days_before, today)} todayISO={today} first={index === 0} last={index === list.length - 1}
    testIDPrefix={testIDPrefix} onPress={() => openDetails(subscription)} />);

  return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load('refresh'); }} tintColor={tokens.brandCyan} colors={[tokens.brandCyan]} accessibilityLabel={t('subscription.refreshing')} />}>
    {/* 1. Compact header with an Add action. */}
    <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
    <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('subscription.eyebrow')}</Text>
    <View style={styles.titleRow}>
      <Text style={[styles.title, { color: tokens.screenText }]}>{t('subscription.title')}</Text>
      {state === 'ready' && subscriptions.length > 0 && <Pressable testID="subscription-add" accessibilityRole="button" accessibilityLabel={t('subscription.add')} onPress={addSubscription}
        style={({ pressed }) => [styles.add, { backgroundColor: tokens.brandBlue }, pressed && styles.pressed]}>
        <Ionicons name="add" size={18} color={tokens.cardText} /><Text style={[styles.addText, { color: tokens.cardText }]}>{t('subscription.addShort')}</Text>
      </Pressable>}
    </View>
    <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('subscription.subtitle')}</Text>
    {(feedback || routeFeedback) && <View style={[styles.notice, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} accessibilityRole="alert">
      <Ionicons name={feedback?.kind === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={20} color={feedback?.kind === 'error' ? tokens.cardErrorText : tokens.successText} />
      <Text style={[styles.noticeText, { color: tokens.cardText }]}>{feedback?.text ?? routeFeedback}</Text>
    </View>}
    {issueText && <View style={[styles.notice, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} accessibilityRole="alert"><Ionicons name="notifications-off-outline" size={20} color={tokens.brandCyan} /><Text style={[styles.noticeText, { color: tokens.cardText }]}>{issueText}</Text></View>}

    {state === 'loading' ? <View style={card}><ActivityIndicator color={tokens.brandCyan} accessibilityLabel={t('subscription.loading')} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('subscription.loading')}</Text></View>
      : state === 'error' ? <View style={card}>
        <Ionicons name="alert-circle-outline" size={24} color={tokens.brandCyan} />
        <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('subscription.loadError')}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.link}><Text style={[styles.linkText, { color: tokens.brandCyan }]}>{t('subscription.retry')}</Text></Pressable>
      </View>
        : !subscriptions.length ? <View style={card} testID="subscriptions-empty">
          <Ionicons name="repeat-outline" size={24} color={tokens.brandCyan} />
          <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('subscription.emptyTitle')}</Text>
          <Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('subscription.emptyBody')}</Text>
          <View style={styles.fullWidth}><PrimaryButton onPress={addSubscription}>{t('subscription.addFirst')}</PrimaryButton></View>
        </View>
          : <>
            {/* 2. Compact monthly overview: the existing calculation, with no formula shown. */}
            <View style={[styles.summary, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} testID="subscriptions-summary">
              {monthlyCents !== null ? <>
                <Text style={[styles.summaryLabel, { color: tokens.cardMutedText }]}>{t('subscription.monthlyEquivalentLabel')}</Text>
                <AnimatedMoneyAmount testID="subscriptions-monthly" cents={monthlyCents} memoryKey={`subscriptions-monthly:${userId}`}
                  accessibilityLabel={`${t('subscription.monthlyEquivalentLabel')}, ${formatRinggit(monthlyCents / 100)}`} style={[styles.total, { color: tokens.cardText }]} />
                <Text style={[styles.count, { color: tokens.cardMutedText }]}>{active.length === 1 ? t('subscription.activeOne') : t('subscription.activeMany', { count: active.length })}</Text>
              </> : <View style={styles.noActive}>
                <Text style={[styles.count, { color: tokens.cardText }]}>{t('subscription.activeNone')}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t('subscription.add')} onPress={addSubscription} style={styles.link}><Text style={[styles.linkText, { color: tokens.brandCyan }]}>{t('subscription.add')}</Text></Pressable>
              </View>}
            </View>

            {/* 3. Needs attention: only real overdue / today / soon renewals, at most three. */}
            {attention.length > 0 && <>
              <Text style={[styles.sectionTitle, { color: tokens.screenText }]}>{t('subscription.attentionTitle')}</Text>
              <View testID="subscriptions-attention">{rows(attention.map((entry) => entry.subscription), 'subscription-attention')}</View>
            </>}

            {/* 4. Active subscriptions: one compact list. */}
            {active.length > 0 && <>
              <Text style={[styles.sectionTitle, { color: tokens.screenText }]}>{t('subscription.active')}</Text>
              <View testID="subscriptions-active">{rows(active)}</View>
            </>}

            {/* Paused plans stay out of the active list, behind a compact expander. */}
            {paused.length > 0 && <>
              <Pressable testID="subscriptions-paused-toggle" accessibilityRole="button" accessibilityState={{ expanded: pausedOpen }} aria-expanded={pausedOpen}
                accessibilityLabel={t(pausedOpen ? 'subscription.pausedHide' : 'subscription.pausedShow', { count: paused.length })} onPress={() => setPausedOpen((open) => !open)}
                style={({ pressed }) => [styles.pausedToggle, pressed && styles.pressed]}>
                <Text style={[styles.pausedTitle, { color: tokens.screenText }]}>{t('subscription.pausedCount', { count: paused.length })}</Text>
                <Ionicons name={pausedOpen ? 'chevron-up' : 'chevron-down'} size={18} color={tokens.mutedText} />
              </Pressable>
              {pausedOpen && <View testID="subscriptions-paused">{rows(paused)}</View>}
            </>}
          </>}

    {/* 5. Details and actions, in place. */}
    <SubscriptionDetailsSheet subscription={selected} todayISO={today} busy={busyId === selected?.id} confirm={confirm} onClose={closeDetails}
      onRenew={() => { if (selected) { setRenewError(false); setRenewing(selected); } }}
      onEdit={() => { if (!selected) return; const id = selected.id; closeDetails(); router.push({ pathname: '/subscription-entry', params: { id } }); }}
      onToggleActive={() => { if (selected) void toggleActive(selected); }}
      onDelete={() => { if (selected) { setDeleteError(false); setDeleting(selected); } }}
      onConfirm={() => { void (renewing ? confirmRenew() : confirmDelete()); }}
      onCancelConfirm={() => { if (!renewBusy && !deleteBusy) { setRenewing(null); setDeleting(null); } }} />
  </Screen>;
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space3 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space3 },
  title: { ...typography.screenTitle, flexShrink: 1 },
  add: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space1, paddingHorizontal: spacing.space4, borderRadius: radius.radiusFull },
  addText: { ...typography.body, fontWeight: '700' },
  helper: { ...typography.label, lineHeight: 19, marginTop: spacing.space1, marginBottom: spacing.space5 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, padding: spacing.space3, borderRadius: radius.radiusMd, borderWidth: 1, marginBottom: spacing.space4 },
  noticeText: { ...typography.body, flex: 1, lineHeight: 22 },
  card: { alignItems: 'flex-start', borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space2 },
  cardTitle: { ...typography.body, fontWeight: '700' }, muted: { ...typography.body, lineHeight: 22 }, fullWidth: { width: '100%', marginTop: spacing.space2 },
  link: { minHeight: 44, justifyContent: 'center' }, linkText: { ...typography.body, fontWeight: '600' },
  summary: { borderWidth: 1, borderRadius: radius.radiusLg, paddingHorizontal: spacing.space5, paddingVertical: spacing.space4, gap: spacing.space1 },
  summaryLabel: { ...typography.label }, total: { ...typography.numeric, fontSize: 30 }, count: { ...typography.label },
  noActive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space3 },
  sectionTitle: { ...typography.body, fontWeight: '700', marginTop: spacing.space6, marginBottom: spacing.space2 },
  pausedToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.space4 },
  pausedTitle: { ...typography.body, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
