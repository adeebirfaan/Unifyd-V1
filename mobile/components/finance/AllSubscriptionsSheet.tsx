import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, SectionList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SubscriptionDateHeader } from '@/components/finance/SubscriptionDateHeader';
import { SubscriptionListItem } from '@/components/finance/SubscriptionListItem';
import { radius, spacing, typography } from '@/constants/theme';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { groupSubscriptionsByDate, renewalStatus } from '@/lib/subscriptions';
import type { SubscriptionRecord } from '@/lib/subscriptions';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export type SubscriptionSheetKind = 'attention' | 'active';

/**
 * Every subscription in one overview section ("needing attention" or "active"), grouped by renewal date, in a
 * near-full-height sheet. It copies Wallet's `AllExpensesSheet`: the same sizing, handle, title and count, close
 * button, sticky date headers, one virtualised list, and drag-to-close through `useSheetDrag` (the backdrop and
 * Android back also close it). It shows the screen's loaded list, so it updates after any action there.
 * `onClosed` fires once the sheet has gone (iOS), so the details sheet can open without two modals overlapping.
 */
export function AllSubscriptionsSheet({ kind, subscriptions, state, todayISO, onClose, onClosed, onRetry, onOpen }: {
  kind: SubscriptionSheetKind | null; subscriptions: readonly SubscriptionRecord[]; state: 'loading' | 'ready' | 'error'; todayISO: string;
  onClose: () => void; onClosed: () => void; onRetry: () => void; onOpen: (subscription: SubscriptionRecord) => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const visible = kind !== null;
  const { opening, offset, reduceMotion, headerHandlers, listHandlers, onListScroll } = useSheetDrag(visible, onClose);
  const count = subscriptions.length;
  const sections = useMemo(() => groupSubscriptionsByDate(subscriptions).map((group) => ({ ...group, key: group.date, data: group.subscriptions })), [subscriptions]);
  const muted = [styles.message, { color: tokens.cardMutedText }];

  return <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose} onDismiss={onClosed}>
    <View style={styles.root}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: tokens.modalScrim }]} accessibilityLabel={t('subscription.closeAll')} onPress={onClose} />
      <Animated.View key={opening} testID="all-subscriptions-sheet" accessibilityViewIsModal aria-modal
        style={[styles.sheet, { maxHeight: height - insets.top - spacing.space6, backgroundColor: tokens.cardBackground, borderColor: tokens.border, transform: [{ translateY: offset }] }]}>
        <View {...headerHandlers} style={styles.top}>
          <View style={[styles.handle, { backgroundColor: tokens.border }]} />
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={[styles.title, { color: tokens.cardText }]}>{t(kind === 'attention' ? 'subscription.allAttention' : 'subscription.allActive')}</Text>
              {state === 'ready' && <Text testID="all-subscriptions-count" style={[styles.subtitle, { color: tokens.cardMutedText }]}>{count === 1 ? t('subscription.countOne') : t('subscription.countMany', { count })}</Text>}
            </View>
            <Pressable testID="all-subscriptions-close" accessibilityRole="button" accessibilityLabel={t('subscription.closeAll')} onPress={onClose}
              style={({ pressed }) => [styles.close, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, pressed && styles.pressed]}>
              <Ionicons name="close" size={22} color={tokens.cardText} />
            </Pressable>
          </View>
        </View>
        {state === 'loading' ? <View style={styles.state}><ActivityIndicator color={tokens.brandCyan} accessibilityLabel={t('subscription.loading')} /><Text style={muted}>{t('subscription.loading')}</Text></View>
          : state === 'error' ? <View style={styles.state}>
            <Text style={muted}>{t('subscription.loadError')}</Text>
            <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={[styles.retryText, { color: tokens.brandCyan }]}>{t('subscription.retry')}</Text></Pressable>
          </View>
            : !count ? <View style={styles.state}><Text style={muted}>{t('subscription.sheetEmpty')}</Text></View>
              : <View {...listHandlers} style={styles.listWrap}>
                <SectionList
                  sections={sections}
                  keyExtractor={(subscription) => subscription.id}
                  stickySectionHeadersEnabled
                  renderSectionHeader={({ section }) => <SubscriptionDateHeader onCard date={section.date} todayISO={todayISO} />}
                  style={styles.list}
                  contentContainerStyle={{ paddingHorizontal: spacing.space4, paddingBottom: Math.max(insets.bottom, spacing.space4) + spacing.space4 }}
                  renderItem={({ item, index, section }) => <SubscriptionListItem subscription={item} testIDPrefix="subscription-sheet-row" todayISO={todayISO}
                    status={renewalStatus(item.next_billing_date, item.reminder_days_before, todayISO)} first={index === 0} last={index === section.data.length - 1} onPress={() => onOpen(item)} />}
                  initialNumToRender={20}
                  scrollEventThrottle={16}
                  onScroll={onListScroll}
                />
              </View>}
      </Animated.View>
    </View>
  </Modal>;
}

// Kept in step with AllExpensesSheet.
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
  state: { alignItems: 'center', gap: spacing.space2, paddingHorizontal: spacing.space5, paddingTop: spacing.space4, paddingBottom: spacing.space8 },
  message: { ...typography.body, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center' }, retryText: { ...typography.body, fontWeight: '600' },
});
