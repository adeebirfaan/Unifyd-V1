import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import type { TranslationKey } from '@/constants/i18n';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Action = { key: string; icon: IconName; label: TranslationKey; a11y: TranslationKey; onPress: () => void; primary?: boolean };

/**
 * Four compact shortcuts in a fixed order (Add expense, Scan receipt, Budget, Split bills), then a slim
 * link to Subscriptions so it stays reachable without crowding the row. All reuse existing routes.
 */
export function FinanceQuickActions({ hasBudget, onAddExpense, onScan, onBudget, onSplitBills, onSubscriptions }: {
  hasBudget: boolean; onAddExpense: () => void; onScan: () => void; onBudget: () => void; onSplitBills: () => void; onSubscriptions: () => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const actions: Action[] = [
    { key: 'add', icon: 'add', label: 'wallet.actionAdd', a11y: 'wallet.add', onPress: onAddExpense, primary: true },
    { key: 'scan', icon: 'scan-outline', label: 'wallet.actionScan', a11y: 'scan.entry', onPress: onScan },
    // The visible label stays short; screen readers hear whether a budget will be set or managed.
    { key: 'budget', icon: 'pie-chart-outline', label: 'wallet.actionBudget', a11y: hasBudget ? 'budget.manage' : 'budget.set', onPress: onBudget },
    { key: 'split', icon: 'people-outline', label: 'wallet.actionSplit', a11y: 'split.entry', onPress: onSplitBills },
  ];
  return <View testID="finance-quick-actions" style={styles.wrap}>
    <View style={styles.row}>
      {actions.map((action) => <Pressable key={action.key} testID={`quick-${action.key}`} accessibilityRole="button" accessibilityLabel={t(action.a11y)} onPress={action.onPress}
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
        <View style={[styles.icon, action.primary
          ? { backgroundColor: tokens.brandBlue }
          : { backgroundColor: tokens.cardBackground, borderColor: tokens.border, borderWidth: 1 }]}>
          <Ionicons name={action.icon} size={action.primary ? 26 : 22} color={action.primary ? colors.white : tokens.brandCyan} />
        </View>
        <Text style={[styles.label, { color: tokens.screenText }, action.primary && styles.primaryLabel]} numberOfLines={2}>{t(action.label)}</Text>
      </Pressable>)}
    </View>
    <Pressable testID="quick-subscriptions" accessibilityRole="button" accessibilityLabel={t('subscription.entry')} accessibilityHint={t('subscription.entryHint')} onPress={onSubscriptions}
      style={({ pressed }) => [styles.more, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }, pressed && styles.pressed]}>
      <Ionicons name="repeat-outline" size={18} color={tokens.brandCyan} />
      <Text style={[styles.moreText, { color: tokens.cardText }]}>{t('subscription.entry')}</Text>
      <Ionicons name="chevron-forward" size={17} color={tokens.cardMutedText} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.space3 },
  row: { flexDirection: 'row', gap: spacing.space2 },
  tile: { flex: 1, minHeight: 72, alignItems: 'center', gap: spacing.space2, paddingTop: spacing.space1 },
  pressed: { opacity: 0.75 },
  icon: { width: 48, height: 48, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.label, textAlign: 'center', lineHeight: 16 }, primaryLabel: { fontWeight: '700' },
  more: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingHorizontal: spacing.space3, borderRadius: radius.radiusFull, borderWidth: 1 },
  moreText: { ...typography.label, fontWeight: '600' },
});
