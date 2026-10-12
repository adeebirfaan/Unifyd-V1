import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/constants/theme';
import type { BudgetPeriodType } from '@/lib/budgetPeriod';
import { formatPercentage } from '@/lib/budgetSummary';
import { formatRinggit } from '@/lib/expenseHistory';
import type { AttentionItem } from '@/lib/walletOverview';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Up to two factual, actionable items. Renders nothing when there is nothing to act on. */
export function FinanceAttentionCard({ items, period, onBudget, onSubscriptions, onSplitBills, embedded = false }: {
  items: readonly AttentionItem[]; period: BudgetPeriodType; onBudget: () => void; onSubscriptions: () => void; onSplitBills: () => void;
  /** Inside the Finance deck, whose card supplies the surface and border. */
  embedded?: boolean;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  if (!items.length) return null;
  const monthly = period === 'monthly';
  const row = (item: AttentionItem): { icon: IconName; tone: string; text: string; onPress: () => void } => {
    switch (item.kind) {
      case 'overBudget': return { icon: 'alert-circle-outline', tone: tokens.cardErrorText, onPress: onBudget,
        text: t(monthly ? 'wallet.attentionOverMonthly' : 'wallet.attentionOverWeekly', { amount: formatRinggit(item.overCents / 100) }) };
      case 'nearBudget': return { icon: 'warning-outline', tone: tokens.cardWarningText, onPress: onBudget,
        text: t(monthly ? 'wallet.attentionNearMonthly' : 'wallet.attentionNearWeekly', { percent: formatPercentage(item.percent) }) };
      case 'renewals': return { icon: 'repeat-outline', tone: tokens.brandCyan, onPress: onSubscriptions,
        text: item.count === 1 ? t('finance.renewalsOne') : t('finance.renewalsMany', { count: item.count }) };
      case 'owed': return { icon: 'people-outline', tone: tokens.brandCyan, onPress: onSplitBills,
        text: t('finance.owed', { amount: formatRinggit(item.cents / 100) }) };
    }
  };
  const separate = items.some((item) => item.kind === 'renewals' || item.kind === 'owed');
  return <View testID="finance-attention" style={embedded ? styles.embedded : [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <Text style={[styles.title, { color: tokens.cardMutedText }]}>{t('wallet.attentionTitle')}</Text>
    {items.map((item, index) => {
      const { icon, tone, text, onPress } = row(item);
      return <Pressable key={item.kind} testID={`attention-${item.kind}`} accessibilityRole="button" accessibilityLabel={text} onPress={onPress}
        style={({ pressed }) => [styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: tokens.border }, pressed && styles.pressed]}>
        <Ionicons name={icon} size={20} color={tone} />
        <Text testID={`attention-${item.kind}-text`} style={[styles.text, { color: tokens.cardText }]}>{text}</Text>
        <Ionicons name="chevron-forward" size={18} color={tokens.cardMutedText} />
      </Pressable>;
    })}
    {separate && <Text style={[styles.note, { color: tokens.cardMutedText }]}>{t('finance.summaryNote')}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, paddingHorizontal: spacing.space4, paddingTop: spacing.space3, paddingBottom: spacing.space2 },
  embedded: { paddingHorizontal: spacing.space4, paddingTop: spacing.space3, paddingBottom: spacing.space2 },
  title: { ...typography.label, letterSpacing: 1, marginBottom: spacing.space1 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingVertical: spacing.space2 },
  pressed: { opacity: 0.75 },
  text: { ...typography.body, flex: 1, lineHeight: 21 },
  note: { ...typography.label, lineHeight: 18, paddingBottom: spacing.space1 },
});
