import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FinanceNumber } from '@/components/FinanceNumber';
import { radius, spacing, typography } from '@/constants/theme';
import { formatExpenseDate, formatRinggit } from '@/lib/expenseHistory';
import { isBillSettled, outstandingCents, unpaidCount } from '@/lib/splitBills';
import type { SplitBillRecord } from '@/lib/splitBills';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/** Open or Settled, shown with an icon and words, never colour alone. */
export function SettlementBadge({ settled }: { settled: boolean }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const color = settled ? tokens.successText : tokens.brandCyan;
  return <View style={[styles.badge, { backgroundColor: tokens.cardElevated }]}>
    <Ionicons name={settled ? 'checkmark-circle-outline' : 'time-outline'} size={14} color={color} />
    <Text style={[styles.badgeText, { color }]}>{t(settled ? 'split.settled' : 'split.openBadge')}</Text>
  </View>;
}

export function SplitBillRow({ bill, onPress }: { bill: SplitBillRecord; onPress: () => void }) {
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const settled = isBillSettled(bill.split_bill_participants);
  const owed = outstandingCents(bill.split_bill_participants);
  const unpaid = unpaidCount(bill.split_bill_participants);
  return <Pressable testID={`split-bill-${bill.id}`} accessibilityRole="button" accessibilityLabel={t('split.openBill', { title: bill.title })} onPress={onPress} style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <View style={styles.top}><Text style={[styles.title, { color: tokens.cardText }]} numberOfLines={2}>{bill.title}</Text><Ionicons name="chevron-forward" size={20} color={tokens.cardMutedText} /></View>
    <View style={styles.amountRow}>
      <FinanceNumber style={[styles.amount, { color: tokens.cardText }]}>{formatRinggit(Number(bill.total_amount))}</FinanceNumber>
      <Text style={[styles.meta, { color: tokens.cardMutedText }]}>{formatExpenseDate(bill.bill_date, language)}</Text>
    </View>
    <SettlementBadge settled={settled} />
    {!settled && owed > 0 && <Text style={[styles.meta, { color: tokens.cardMutedText }]}>{t('split.owedOnBill', { amount: formatRinggit(owed / 100) })} · {unpaid === 1 ? t('split.unpaidOne') : t('split.unpaidMany', { count: unpaid })}</Text>}
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space2, marginBottom: spacing.space3, alignItems: 'flex-start' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space3, alignSelf: 'stretch' }, title: { ...typography.body, fontWeight: '700', flex: 1, lineHeight: 22 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.space2 }, amount: { ...typography.numeric, fontSize: 20 }, meta: { ...typography.label, lineHeight: 19 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.space1, paddingHorizontal: spacing.space2, paddingVertical: spacing.space1, borderRadius: radius.radiusFull }, badgeText: { ...typography.label },
});
