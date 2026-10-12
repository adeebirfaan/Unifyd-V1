import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FinanceNumber } from '@/components/FinanceNumber';
import { SubscriptionBrandIcon } from '@/components/finance/SubscriptionBrandIcon';
import type { TranslationKey } from '@/constants/i18n';
import { radius, spacing, typography } from '@/constants/theme';
import { formatDayMonth, formatRinggit } from '@/lib/expenseHistory';
import { daysUntil } from '@/lib/subscriptions';
import type { RenewalStatus, SubscriptionRecord } from '@/lib/subscriptions';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;
type IconName = ComponentProps<typeof Ionicons>['name'];
export type AttentionStatus = Exclude<RenewalStatus, 'later'>;

/** "Overdue", "Renews today", or "In 3 days". Always written out, never colour alone. */
export function shortRenewalStatus(status: AttentionStatus, nextBillingDate: string, todayISO: string, t: Translate): string {
  if (status === 'overdue') return t('subscription.short.overdue');
  if (status === 'today') return t('subscription.status.today');
  const days = daysUntil(nextBillingDate, todayISO) ?? 0;
  return days === 1 ? t('subscription.short.inDaysOne') : t('subscription.short.inDaysMany', { count: days });
}

export const statusIcons: Record<AttentionStatus, IconName> = { overdue: 'alert-circle', today: 'today-outline', soon: 'time-outline' };

/**
 * One compact row: tile, name, "Monthly · 21 Oct", amount, and a small status chip only when it needs
 * attention. Rows share one card (`first`/`last` round its corners). Tapping opens the details sheet.
 */
export function SubscriptionListItem({ subscription, status, todayISO, first, last, onPress, testIDPrefix = 'subscription-row' }: {
  subscription: SubscriptionRecord; status: RenewalStatus; todayISO: string; first: boolean; last: boolean; onPress: () => void; testIDPrefix?: string;
}) {
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const amount = formatRinggit(Number(subscription.amount));
  const frequency = t(`subscription.frequency.${subscription.billing_frequency}`);
  const date = formatDayMonth(subscription.next_billing_date, language, todayISO);
  const attention = subscription.is_active && status !== 'later' ? status : null;
  const statusText = attention ? shortRenewalStatus(attention, subscription.next_billing_date, todayISO, t) : null;
  const tone = attention === 'overdue' ? tokens.cardErrorText : attention === 'today' ? tokens.cardWarningText : tokens.brandCyan;
  const label = [t('subscription.rowA11y', { name: subscription.name, amount, frequency, date }), statusText, subscription.is_active ? null : t('subscription.pausedBadge')]
    .filter(Boolean).join(', ');

  return <Pressable testID={`${testIDPrefix}-${subscription.id}`} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t('subscription.rowHint')} onPress={onPress}
    style={({ pressed }) => [styles.row, { backgroundColor: tokens.cardBackground, borderColor: tokens.border },
      first ? styles.first : { borderTopWidth: StyleSheet.hairlineWidth }, last && styles.last, pressed && { backgroundColor: tokens.cardElevated }]}>
    <SubscriptionBrandIcon name={subscription.name} />
    <View style={styles.copy}>
      <Text style={[styles.name, { color: tokens.cardText }]} numberOfLines={1}>{subscription.name}</Text>
      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: tokens.cardMutedText }]} numberOfLines={1}>{frequency} · {date}</Text>
        {statusText && <View style={styles.chip}><Ionicons name={statusIcons[attention!]} size={13} color={tone} /><Text style={[styles.chipText, { color: tone }]} numberOfLines={1}>{statusText}</Text></View>}
      </View>
    </View>
    <FinanceNumber style={[styles.amount, { color: subscription.is_active ? tokens.cardText : tokens.cardMutedText }]}>{amount}</FinanceNumber>
    <Ionicons name="chevron-forward" size={18} color={tokens.cardMutedText} />
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3, borderLeftWidth: 1, borderRightWidth: 1 },
  first: { borderTopWidth: 1, borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg },
  last: { borderBottomWidth: 1, borderBottomLeftRadius: radius.radiusLg, borderBottomRightRadius: radius.radiusLg },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.body, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.space2 },
  meta: { ...typography.label, flexShrink: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3 }, chipText: { ...typography.label, fontWeight: '600' },
  amount: { ...typography.body, flexShrink: 0 },
});
