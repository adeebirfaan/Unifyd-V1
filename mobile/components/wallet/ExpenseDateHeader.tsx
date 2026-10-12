import { StyleSheet, Text, View } from 'react-native';

import { FinanceNumber } from '@/components/FinanceNumber';
import { spacing, typography } from '@/constants/theme';
import { relativeDay } from '@/lib/expenseGroups';
import { localDateISO } from '@/lib/expenseForm';
import { formatExpenseDate, formatExpenseDateLong, formatRinggit } from '@/lib/expenseHistory';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * A light date heading above one day's expenses: "Today", "Yesterday", or the date, with that day's total.
 * `onCard` is for headers inside the dark sheet; otherwise they sit on the page and follow Light mode.
 */
export function ExpenseDateHeader({ date, totalCents, onCard = false }: { date: string; totalCents: number; onCard?: boolean }) {
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const relative = relativeDay(date, localDateISO());
  const label = relative ? t(relative === 'today' ? 'wallet.today' : 'wallet.yesterday') : formatExpenseDate(date, language);
  const total = formatRinggit(totalCents / 100);
  const muted = onCard ? tokens.cardMutedText : tokens.mutedText;
  return <View testID={`expense-day-${date}`} accessible accessibilityRole="header"
    accessibilityLabel={t('wallet.dayGroupA11y', { date: formatExpenseDateLong(date, language), amount: total })}
    style={[styles.row, onCard && { backgroundColor: tokens.cardBackground }]}>
    <Text style={[styles.label, { color: muted }]}>{label}</Text>
    <FinanceNumber testID={`expense-day-total-${date}`} style={[styles.total, { color: onCard ? tokens.cardText : tokens.screenText }]}>{total}</FinanceNumber>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space3, paddingTop: spacing.space3, paddingBottom: spacing.space2 },
  label: { ...typography.label, fontWeight: '700' },
  total: { fontSize: 13 },
});
