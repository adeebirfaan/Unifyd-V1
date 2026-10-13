import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SaveSuccessOverlay } from '@/components/finance/SaveSuccessOverlay';
import type { OverlayPhase } from '@/components/finance/SaveSuccessOverlay';
import { SubscriptionBrandIcon } from '@/components/finance/SubscriptionBrandIcon';
import type { SwipeOrigin } from '@/components/finance/SwipeToSave';
import { radius, spacing, typography } from '@/constants/theme';
import { useI18n } from '@/providers/LanguageProvider';

export type { OverlayPhase };
export type SavedSummary = { name: string; amount: string; frequency: string; reminder: { text: string; label: string; issue: boolean; canRetry: boolean } };

/**
 * Add subscription's use of the shared `SaveSuccessOverlay`: "Subscription added", the amount, the tile with
 * "Name · Frequency", and a reminder pill only when the reminder could not be set (with a retry when that can help).
 */
export function SubscriptionSavedOverlay({ phase, origin, summary, retrying, onContinue, onRetryReminder, onHidden, reduceMotion }: {
  phase: OverlayPhase; origin: SwipeOrigin | null; summary: SavedSummary | null; retrying: boolean;
  onContinue: () => void; onRetryReminder: () => void; onHidden: () => void; reduceMotion: boolean;
}) {
  const { t } = useI18n();
  // Success is shown only once its summary exists.
  return <SaveSuccessOverlay testIDPrefix="subscription" phase={phase === 'success' && !summary ? 'saving' : phase} origin={origin} reduceMotion={reduceMotion}
    savingLabel={t('subscription.saving')} title={t('subscription.added')} amount={summary?.amount ?? ''} continueLabel={t('subscription.tapToContinue')}
    announcement={summary ? t('subscription.addedA11y', { name: summary.name, amount: summary.amount, frequency: summary.frequency }) : t('subscription.added')}
    onContinue={onContinue} onHidden={onHidden}
    details={(ink) => summary && <>
      <View style={styles.identity}>
        <SubscriptionBrandIcon name={summary.name} size={28} />
        <Text style={[styles.name, { color: ink }]} numberOfLines={1}>{summary.name} · {summary.frequency}</Text>
      </View>
      {/* A reminder that is set needs no words here; only a problem is mentioned, as a short pill whose
          accessible label is the full explanation. */}
      {summary.reminder.issue && <View testID="subscription-overlay-reminder" accessible accessibilityLabel={summary.reminder.label} style={[styles.reminder, { borderColor: ink }]}>
        <Ionicons name="alert-circle-outline" size={15} color={ink} />
        <Text style={[styles.reminderText, { color: ink }]} numberOfLines={1}>{summary.reminder.text}</Text>
      </View>}
      {summary.reminder.canRetry && <Pressable accessibilityRole="button" accessibilityState={{ busy: retrying, disabled: retrying }} disabled={retrying} onPress={onRetryReminder} style={styles.retry}>
        {retrying && <ActivityIndicator color={ink} />}
        <Text style={[styles.retryText, { color: ink }]}>{retrying ? t('subscription.retryingReminder') : t('subscription.retryReminder')}</Text>
      </Pressable>}
    </>} />;
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, maxWidth: '100%' },
  name: { ...typography.body, fontWeight: '600', flexShrink: 1 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: spacing.space1, borderWidth: 1, borderRadius: radius.radiusFull, paddingHorizontal: spacing.space3, paddingVertical: spacing.space1 + 2, marginTop: spacing.space4, maxWidth: '100%' },
  reminderText: { ...typography.label, fontWeight: '500', flexShrink: 1 },
  retry: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingHorizontal: spacing.space4 },
  retryText: { ...typography.label, textDecorationLine: 'underline' },
});
