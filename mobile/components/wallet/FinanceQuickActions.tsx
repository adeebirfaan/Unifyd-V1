import { View } from 'react-native';

import { IconQuickActions } from '@/components/IconQuickActions';
import type { IconQuickAction } from '@/components/IconQuickActions';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * Wallet's shortcuts in a fixed order: Add expense, Scan receipt, Budget, Split bills, then Subscriptions first on
 * the second row, all the same tile in the shared `IconQuickActions` grid (also used by Studies). Further Finance
 * actions continue that row in order. All reuse existing routes.
 */
export function FinanceQuickActions({ hasBudget, onAddExpense, onScan, onBudget, onSplitBills, onSubscriptions }: {
  hasBudget: boolean; onAddExpense: () => void; onScan: () => void; onBudget: () => void; onSplitBills: () => void; onSubscriptions: () => void;
}) {
  const { t } = useI18n();
  const actions: IconQuickAction[] = [
    { key: 'add', icon: 'add', label: t('wallet.actionAdd'), a11y: t('wallet.add'), onPress: onAddExpense, primary: true },
    { key: 'scan', icon: 'scan-outline', label: t('wallet.actionScan'), a11y: t('scan.entry'), onPress: onScan },
    // The visible label stays short; screen readers hear whether a budget will be set or managed.
    { key: 'budget', icon: 'pie-chart-outline', label: t('wallet.actionBudget'), a11y: t(hasBudget ? 'budget.manage' : 'budget.set'), onPress: onBudget },
    { key: 'split', icon: 'people-outline', label: t('wallet.actionSplit'), a11y: t('split.entry'), onPress: onSplitBills },
    { key: 'subscriptions', icon: 'repeat-outline', label: t('subscription.entry'), a11y: t('subscription.entry'), hint: t('subscription.entryHint'), onPress: onSubscriptions },
  ];
  return <View testID="finance-quick-actions"><IconQuickActions actions={actions} testIDPrefix="quick" /></View>;
}
