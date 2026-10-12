import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Animated, Modal, Pressable, SectionList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExpenseDateHeader } from '@/components/wallet/ExpenseDateHeader';
import { ExpenseHistoryRow } from '@/components/wallet/ExpenseHistoryRow';
import { radius, spacing, typography } from '@/constants/theme';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { groupExpensesByDate } from '@/lib/expenseGroups';
import type { ExpenseRecord } from '@/lib/expenseHistory';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * Full expense history in a near-full-height sheet over Wallet (no new route or tab). It shows the rows
 * Wallet already loaded, newest first, with the same row look and tap behaviour. Follows the ShadePicker
 * sheet pattern; Reduce Motion opens and closes it without movement.
 *
 * Drag to close (`useSheetDrag`): from the handle/title area, or from the list when it is scrolled to the top.
 * The close button, the backdrop, and Android back also close it.
 */

export function AllExpensesSheet({ visible, expenses, onClose, onOpenExpense }: {
  visible: boolean; expenses: readonly ExpenseRecord[]; onClose: () => void; onOpenExpense: (expense: ExpenseRecord) => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { opening, offset, reduceMotion, headerHandlers, listHandlers, onListScroll } = useSheetDrag(visible, onClose);
  const count = expenses.length;
  // Every loaded expense, grouped by day; rows from later pages merge into the same day's group.
  const sections = useMemo(() => groupExpensesByDate(expenses).map((group) => ({ ...group, key: group.date, data: group.expenses })), [expenses]);

  return <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
    <View style={styles.root}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: tokens.modalScrim }]} accessibilityLabel={t('wallet.closeHistory')} onPress={onClose} />
      <Animated.View key={opening} testID="all-expenses-sheet" accessibilityViewIsModal aria-modal
        style={[styles.sheet, { maxHeight: height - insets.top - spacing.space6, backgroundColor: tokens.cardBackground, borderColor: tokens.border, transform: [{ translateY: offset }] }]}>
        <View testID="all-expenses-drag" {...headerHandlers} style={styles.top}>
          <View style={[styles.handle, { backgroundColor: tokens.border }]} />
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={[styles.title, { color: tokens.cardText }]}>{t('wallet.allExpenses')}</Text>
              <Text style={[styles.subtitle, { color: tokens.cardMutedText }]}>{count === 1 ? t('wallet.oneRecorded') : t('wallet.manyRecorded', { count })}</Text>
            </View>
            <Pressable testID="all-expenses-close" accessibilityRole="button" accessibilityLabel={t('wallet.closeHistory')} onPress={onClose}
              style={({ pressed }) => [styles.close, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, pressed && styles.pressed]}>
              <Ionicons name="close" size={22} color={tokens.cardText} />
            </Pressable>
          </View>
        </View>
        <View {...listHandlers} style={styles.listWrap}>
        <SectionList
          sections={sections}
          keyExtractor={(expense) => expense.id}
          // Native sticky headers keep each date with its rows while scrolling; the header has the sheet's background.
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => <ExpenseDateHeader onCard date={section.date} totalCents={section.totalCents} />}
          style={styles.list}
          contentContainerStyle={{ paddingHorizontal: spacing.space4, paddingBottom: Math.max(insets.bottom, spacing.space4) + spacing.space4 }}
          renderItem={({ item, index, section }) => <ExpenseHistoryRow expense={item} first={index === 0} last={index === section.data.length - 1} onPress={() => onOpenExpense(item)} />}
          initialNumToRender={20}
          scrollEventThrottle={16}
          onScroll={onListScroll}
        />
        </View>
      </Animated.View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 568, alignSelf: 'center', flexShrink: 1, borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg, borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden' },
  top: { paddingHorizontal: spacing.space5, paddingTop: spacing.space3, paddingBottom: spacing.space3, gap: spacing.space3 },
  handle: { width: 40, height: 4, borderRadius: radius.radiusFull, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  headerCopy: { flex: 1, gap: 2 },
  title: { ...typography.sectionTitle }, subtitle: { ...typography.label },
  close: { width: 44, height: 44, borderRadius: radius.radiusFull, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  listWrap: { flexShrink: 1 }, list: { flexGrow: 0 },
});
