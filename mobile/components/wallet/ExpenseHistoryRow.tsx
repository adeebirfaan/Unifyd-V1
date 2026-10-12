import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/constants/theme';
import type { ExpenseCategory } from '@/lib/expenseForm';
import { FinanceNumber } from '@/components/FinanceNumber';
import { formatExpenseDate, formatRinggit } from '@/lib/expenseHistory';
import type { ExpenseRecord } from '@/lib/expenseHistory';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const categoryIcons: Record<ExpenseCategory, IconName> = {
  food: 'restaurant-outline',
  transport: 'bus-outline',
  academic_materials: 'book-outline',
  personal: 'person-outline',
  other: 'ellipsis-horizontal-outline',
};

/**
 * One compact row of the Recent expenses list. Rows share one card: `first` and `last` round its
 * corners, and a hairline separates rows. Notes are not shown here but stay in the screen-reader label.
 */
export function ExpenseHistoryRow({ expense, onPress, first = true, last = true }: { expense: ExpenseRecord; onPress: () => void; first?: boolean; last?: boolean }) {
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const category = t(`expense.category.${expense.category}`);
  const date = formatExpenseDate(expense.expense_date, language);
  const amount = formatRinggit(Number(expense.amount));
  const note = expense.notes?.trim();

  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${t('expense.openDetail', { title: expense.title })}. ${[category, date, amount, note].filter(Boolean).join(', ')}`}
    style={({ pressed }) => [styles.row, { backgroundColor: tokens.cardBackground, borderColor: tokens.border },
      first ? styles.first : { borderTopWidth: StyleSheet.hairlineWidth }, last && styles.last, pressed && { backgroundColor: tokens.cardElevated }]}>
    <View style={[styles.iconWrap, { backgroundColor: tokens.cardElevated }]}><Ionicons name={categoryIcons[expense.category]} size={20} color={tokens.brandCyan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /></View>
    <View style={styles.content}>
      <Text style={[styles.title, { color: tokens.cardText }]} numberOfLines={1}>{expense.title}</Text>
      <Text style={[styles.meta, { color: tokens.cardMutedText }]} numberOfLines={1}>{category} · {date}</Text>
    </View>
    <FinanceNumber style={[styles.amount, { color: tokens.cardText }]}>{amount}</FinanceNumber>
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3, borderLeftWidth: 1, borderRightWidth: 1 },
  first: { borderTopWidth: 1, borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg },
  last: { borderBottomWidth: 1, borderBottomLeftRadius: radius.radiusLg, borderBottomRightRadius: radius.radiusLg },
  iconWrap: { width: 40, height: 40, borderRadius: radius.radiusSm, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.body, fontWeight: '600' }, meta: { ...typography.label },
  amount: { ...typography.body, flexShrink: 0 },
});
