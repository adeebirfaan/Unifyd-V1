import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/constants/theme';
import type { ExpenseCategory } from '@/lib/expenseForm';
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

export function ExpenseHistoryRow({ expense, onPress }: { expense: ExpenseRecord; onPress: () => void }) {
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const category = t(`expense.category.${expense.category}`);
  const date = formatExpenseDate(expense.expense_date, language);
  const amount = formatRinggit(Number(expense.amount));
  const note = expense.notes?.trim();

  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${t('expense.openDetail', { title: expense.title })}. ${[category, date, amount, note].filter(Boolean).join(', ')}`} style={({ pressed }) => [styles.row, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }, pressed && styles.pressed]}>
    <View style={[styles.iconWrap, { backgroundColor: tokens.cardElevated }]}><Ionicons name={categoryIcons[expense.category]} size={22} color={tokens.brandCyan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /></View>
    <View style={styles.content}>
      <View style={styles.topLine}>
        <Text style={[styles.category, { color: tokens.brandCyan }]} numberOfLines={2}>{category}</Text>
        <Text style={[styles.amount, { color: tokens.cardText }]}>{amount}</Text>
      </View>
      <Text style={[styles.title, { color: tokens.cardText }]} numberOfLines={2}>{expense.title}</Text>
      <Text style={[styles.date, { color: tokens.cardMutedText }]}>{date}</Text>
      {note ? <Text style={[styles.note, { color: tokens.cardMutedText }]} numberOfLines={1}>{note}</Text> : null}
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { minHeight: 104, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space3, borderRadius: radius.radiusMd, borderWidth: 1, padding: spacing.space4, marginBottom: spacing.space3 },
  pressed: { opacity: 0.8 },
  iconWrap: { width: 44, height: 44, borderRadius: radius.radiusSm, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, minWidth: 0, gap: spacing.space1 }, topLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2 },
  category: { ...typography.label, flex: 1, lineHeight: 18 }, amount: { ...typography.body, fontWeight: '700', flexShrink: 0 },
  title: { ...typography.body, fontWeight: '600', lineHeight: 22 }, date: { ...typography.label }, note: { ...typography.label },
});
