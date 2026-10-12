import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ConfirmDialog } from '@/components/finance/ConfirmDialog';
import { SubscriptionForm } from '@/components/finance/SubscriptionForm';
import { radius, spacing, typography } from '@/constants/theme';
import { refreshSubscriptionReminder } from '@/lib/subscriptionReminders';
import { SUBSCRIPTION_COLUMNS } from '@/lib/subscriptions';
import type { SubscriptionInput, SubscriptionRecord } from '@/lib/subscriptions';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error' | 'notFound';

/** Add a subscription, or edit/delete one when `id` is given. */
export default function SubscriptionEntryScreen() {
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const id = typeof idParam === 'string' && idParam ? idParam : undefined;
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<LoadState>(id ? 'loading' : 'ready');
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    if (!id) return;
    const version = ++requestVersion.current;
    setState('loading');
    if (!userId) { setState('error'); return; }
    try {
      const { data, error } = await supabase.from('subscriptions').select(SUBSCRIPTION_COLUMNS)
        .eq('id', id).eq('user_id', userId).maybeSingle();
      if (version !== requestVersion.current) return;
      if (error) throw error;
      if (!data) { setState('notFound'); return; }
      setSubscription(data as SubscriptionRecord);
      setState('ready');
    } catch { if (version === requestVersion.current) setState('error'); }
  }, [id, userId]);

  useFocusEffect(useCallback(() => {
    if (id && !subscription) void load();
    return () => { ++requestVersion.current; };
  }, [id, subscription, load]));

  async function save(input: SubscriptionInput): Promise<boolean> {
    if (!userId) return false;
    try {
      if (subscription) {
        const { data, error } = await supabase.from('subscriptions').update(input)
          .eq('id', subscription.id).eq('user_id', userId).select('id').maybeSingle();
        if (error || !data) return false;
      } else {
        const { error } = await supabase.from('subscriptions').insert({ user_id: userId, ...input });
        if (error) return false;
      }
      const reminderIssue = await refreshSubscriptionReminder(userId, language, input);
      router.dismissTo({ pathname: '/subscriptions', params: { [subscription ? 'updated' : 'saved']: '1', reminderIssue } });
      return true;
    } catch { return false; }
  }

  async function confirmDelete() {
    if (!subscription || !userId || deleting) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      const { data, error } = await supabase.from('subscriptions').delete()
        .eq('id', subscription.id).eq('user_id', userId).select('id').maybeSingle();
      if (error || !data) { setDeleteError(true); return; }
      setConfirming(false);
      await refreshSubscriptionReminder(userId, language, null);
      router.dismissTo({ pathname: '/subscriptions', params: { deleted: '1' } });
    } catch { setDeleteError(true); }
    finally { setDeleting(false); }
  }

  return <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.fill} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
        <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('subscription.eyebrow')}</Text>
        <Text style={[styles.title, { color: tokens.screenText }]}>{id ? t('subscription.edit') : t('subscription.add')}</Text>
        <Text style={[styles.helper, { color: tokens.mutedText }]}>{id ? t('subscription.editHelper') : t('subscription.addHelper')}</Text>
        {state === 'ready' && (!id || subscription) ? <>
          <SubscriptionForm key={subscription?.id ?? 'new'} initial={subscription ?? undefined} onSave={save} />
          {subscription && <Pressable accessibilityRole="button" onPress={() => { setDeleteError(false); setConfirming(true); }} style={[styles.deleteButton, { backgroundColor: tokens.destructiveBackground }]}>
            <Ionicons name="trash-outline" size={20} color={tokens.destructiveForeground} /><Text style={[styles.deleteText, { color: tokens.destructiveForeground }]}>{t('subscription.delete')}</Text>
          </Pressable>}
        </> : <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          {state === 'loading' && <ActivityIndicator size="large" color={tokens.brandCyan} />}
          <Text style={[styles.message, { color: tokens.cardMutedText }]}>{state === 'loading' ? t('subscription.detailLoading') : state === 'notFound' ? t('subscription.notFound') : t('subscription.detailError')}</Text>
          {state !== 'loading' && <PrimaryButton onPress={() => { void load(); }}>{t('subscription.retry')}</PrimaryButton>}
        </View>}
      </View>
    </ScrollView>
    <ConfirmDialog testID="subscription-delete-dialog" visible={confirming} busy={deleting} destructive error={deleteError ? t('subscription.deleteError') : null}
      title={t('subscription.deleteTitle')} body={subscription ? t('subscription.deleteBody', { name: subscription.name }) : ''}
      confirmLabel={t('subscription.delete')} cancelLabel={t('subscription.cancel')}
      onConfirm={() => { void confirmDelete(); }} onCancel={() => { if (!deleting) setConfirming(false); }} />
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: spacing.space6 }, inner: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space5 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 }, title: { ...typography.screenTitle, marginBottom: spacing.space2 },
  helper: { ...typography.body, lineHeight: 23, marginBottom: spacing.space6 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space4 }, message: { ...typography.body, lineHeight: 23 },
  deleteButton: { minHeight: 54, borderRadius: radius.radiusMd, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2, paddingHorizontal: spacing.space4, marginTop: spacing.space4 },
  deleteText: { ...typography.body, fontWeight: '700' },
});
