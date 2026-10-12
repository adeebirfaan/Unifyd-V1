import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { SplitBillForm } from '@/components/finance/SplitBillForm';
import type { SplitBillInput, SplitPersonInput, SplitSaveResult } from '@/components/finance/SplitBillForm';
import { radius, spacing, typography } from '@/constants/theme';
import { SPLIT_BILL_COLUMNS } from '@/lib/splitBills';
import type { SplitBillRecord } from '@/lib/splitBills';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error' | 'notFound';

function participantRow(billId: string, person: SplitPersonInput, now: string) {
  // You paid the bill, so your own share is always settled; new people start unpaid.
  return { split_bill_id: billId, participant_name: person.name, share_amount: person.shareCents / 100, is_self: person.isSelf, is_settled: person.isSelf, settled_at: person.isSelf ? now : null };
}

/** Create a split bill, or edit one when `id` is given. Deleting lives on the bill detail screen. */
export default function SplitBillEntryScreen() {
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const id = typeof idParam === 'string' && idParam ? idParam : undefined;
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<LoadState>(id ? 'loading' : 'ready');
  const [bill, setBill] = useState<SplitBillRecord | null>(null);
  const [partial, setPartial] = useState(false);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    if (!id) return;
    const version = ++requestVersion.current;
    setState('loading');
    if (!userId) { setState('error'); return; }
    try {
      const { data, error } = await supabase.from('split_bills').select(SPLIT_BILL_COLUMNS).eq('id', id).eq('user_id', userId).maybeSingle();
      if (version !== requestVersion.current) return;
      if (error) throw error;
      if (!data) { setState('notFound'); return; }
      setBill(data as SplitBillRecord);
      setState('ready');
    } catch { if (version === requestVersion.current) setState('error'); }
  }, [id, userId]);

  useFocusEffect(useCallback(() => {
    if (id && !bill) void load();
    return () => { ++requestVersion.current; };
  }, [id, bill, load]));

  async function create(input: SplitBillInput): Promise<SplitSaveResult> {
    if (!userId) return 'error';
    const { data, error } = await supabase.from('split_bills').insert({ user_id: userId, ...input.bill }).select('id').single();
    if (error || !data) return 'error';
    const now = new Date().toISOString();
    const participants = await supabase.from('split_bill_participants').insert(input.people.map((person) => participantRow(data.id, person, now)));
    if (participants.error) {
      // Without its people the bill is incomplete, so remove it rather than leave a half-saved split.
      await supabase.from('split_bills').delete().eq('id', data.id).eq('user_id', userId);
      return 'error';
    }
    router.dismissTo({ pathname: '/split-bills', params: { saved: '1' } });
    return 'saved';
  }

  async function update(existing: SplitBillRecord, input: SplitBillInput): Promise<SplitSaveResult> {
    if (!userId) return 'error';
    // The Data API has no multi-request transaction, so each step is checked. A failure after the
    // first write is reported as partial; the detail screen flags shares that no longer match the total.
    let changed = false;
    const keptIds = new Set(input.people.flatMap((person) => person.id ? [person.id] : []));
    const removed = existing.split_bill_participants.filter((participant) => !participant.is_self && !keptIds.has(participant.id)).map((participant) => participant.id);
    if (removed.length) {
      const { error } = await supabase.from('split_bill_participants').delete().in('id', removed).eq('split_bill_id', existing.id);
      if (error) return 'error';
      changed = true;
    }
    for (const person of input.people) {
      if (!person.id) continue;
      const before = existing.split_bill_participants.find((participant) => participant.id === person.id);
      const shareAmount = person.shareCents / 100;
      if (before && before.participant_name === person.name && Number(before.share_amount) === shareAmount) continue;
      const { data, error } = await supabase.from('split_bill_participants').update({ participant_name: person.name, share_amount: shareAmount })
        .eq('id', person.id).eq('split_bill_id', existing.id).select('id').maybeSingle();
      if (error || !data) return changed ? 'partial' : 'error';
      changed = true;
    }
    const added = input.people.filter((person) => !person.id);
    if (added.length) {
      const now = new Date().toISOString();
      const { error } = await supabase.from('split_bill_participants').insert(added.map((person) => participantRow(existing.id, person, now)));
      if (error) return changed ? 'partial' : 'error';
      changed = true;
    }
    const { data, error } = await supabase.from('split_bills').update(input.bill).eq('id', existing.id).eq('user_id', userId).select('id').maybeSingle();
    if (error || !data) return changed ? 'partial' : 'error';
    router.dismissTo({ pathname: '/split-bill', params: { id: existing.id, updated: '1' } });
    return 'saved';
  }

  async function save(input: SplitBillInput): Promise<SplitSaveResult> {
    try {
      const result = bill ? await update(bill, input) : await create(input);
      // Reload after a partial edit so the form reflects what was actually saved.
      if (result === 'partial') { setPartial(true); void load(); }
      return result;
    } catch { return 'error'; }
  }

  return <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.fill} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
        <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('split.eyebrow')}</Text>
        <Text style={[styles.title, { color: tokens.screenText }]}>{id ? t('split.edit') : t('split.create')}</Text>
        <Text style={[styles.helper, { color: tokens.mutedText }]}>{id ? t('split.editHelper') : t('split.createHelper')}</Text>
        {partial && <View style={[styles.notice, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} accessibilityRole="alert"><Ionicons name="alert-circle-outline" size={20} color={tokens.cardErrorText} /><Text style={[styles.noticeText, { color: tokens.cardText }]}>{t('split.partialSaveError')}</Text></View>}
        {state === 'ready' && (!id || bill) ? <SplitBillForm key={bill?.id ?? 'new'} initial={bill ?? undefined} onSave={save} />
          : <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
            {state === 'loading' && <ActivityIndicator size="large" color={tokens.brandCyan} />}
            <Text style={[styles.message, { color: tokens.cardMutedText }]}>{state === 'loading' ? t('split.detailLoading') : state === 'notFound' ? t('split.notFound') : t('split.detailError')}</Text>
            {state !== 'loading' && <PrimaryButton onPress={() => { void load(); }}>{t('split.retry')}</PrimaryButton>}
          </View>}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: spacing.space6 }, inner: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space5 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 }, title: { ...typography.screenTitle, marginBottom: spacing.space2 },
  helper: { ...typography.body, lineHeight: 23, marginBottom: spacing.space6 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, padding: spacing.space3, borderRadius: radius.radiusMd, borderWidth: 1, marginBottom: spacing.space4 },
  noticeText: { ...typography.body, flex: 1, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space4 }, message: { ...typography.body, lineHeight: 23 },
});
