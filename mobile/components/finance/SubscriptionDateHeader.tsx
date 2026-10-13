import { StyleSheet, Text, View } from 'react-native';

import { SubscriptionListItem } from '@/components/finance/SubscriptionListItem';
import { spacing, typography } from '@/constants/theme';
import { formatExpenseDate, formatExpenseDateLong } from '@/lib/expenseHistory';
import { renewalDay, renewalStatus } from '@/lib/subscriptions';
import type { SubscriptionDateGroup, SubscriptionRecord } from '@/lib/subscriptions';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * A renewal-date heading in the style of Wallet's `ExpenseDateHeader`: "Today", "Tomorrow", "Yesterday", or the
 * date with its year. Unlike expenses there is no total, because plans billed weekly, monthly, and yearly do not
 * add up to a meaningful day total. `onCard` is for headers inside the dark sheet.
 */
export function SubscriptionDateHeader({ date, todayISO, onCard = false }: { date: string; todayISO: string; onCard?: boolean }) {
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const relative = renewalDay(date, todayISO);
  const label = relative === 'today' ? t('subscription.dayToday') : relative === 'tomorrow' ? t('subscription.dayTomorrow')
    : relative === 'yesterday' ? t('subscription.dayYesterday') : formatExpenseDate(date, language);
  return <View testID={`subscription-day-${date}`} accessible accessibilityRole="header" accessibilityLabel={t('subscription.dayGroupA11y', { date: formatExpenseDateLong(date, language) })}
    style={[styles.row, onCard && { backgroundColor: tokens.cardBackground }]}>
    <Text style={[styles.label, { color: onCard ? tokens.cardMutedText : tokens.mutedText }]}>{label}</Text>
  </View>;
}

/** Date-grouped rows for the overview: one header per renewal date and one shared card per group. */
export function SubscriptionGroups({ groups, todayISO, testID, testIDPrefix, onOpen }: {
  groups: readonly SubscriptionDateGroup<SubscriptionRecord>[]; todayISO: string; testID?: string; testIDPrefix?: string; onOpen: (subscription: SubscriptionRecord) => void;
}) {
  return <View testID={testID}>
    {groups.map((group) => <View key={group.date}>
      <SubscriptionDateHeader date={group.date} todayISO={todayISO} />
      {group.subscriptions.map((subscription, index) => <SubscriptionListItem key={subscription.id} subscription={subscription} testIDPrefix={testIDPrefix}
        status={renewalStatus(subscription.next_billing_date, subscription.reminder_days_before, todayISO)} todayISO={todayISO}
        first={index === 0} last={index === group.subscriptions.length - 1} onPress={() => onOpen(subscription)} />)}
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  // Same spacing and type as Wallet's day headers.
  row: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.space3, paddingBottom: spacing.space2 },
  label: { ...typography.label, fontWeight: '700' },
});
