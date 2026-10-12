import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FinanceNumber } from '@/components/FinanceNumber';
import { SubscriptionBrandIcon } from '@/components/finance/SubscriptionBrandIcon';
import { reminderDaysLabel } from '@/components/finance/SubscriptionForm';
import { shortRenewalStatus, statusIcons } from '@/components/finance/SubscriptionListItem';
import { radius, spacing, typography } from '@/constants/theme';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { formatExpenseDateLong, formatRinggit } from '@/lib/expenseHistory';
import { renewalStatus } from '@/lib/subscriptions';
import type { SubscriptionRecord } from '@/lib/subscriptions';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Details and actions for one subscription, in a sheet over the list (ShadePicker pattern, drag to close,
 * Reduce Motion aware). Every action is explicit: renewing and deleting still go through their confirmations,
 * editing opens the existing edit route, and pause/resume uses the existing update.
 */
export type SheetConfirm = { kind: 'renew' | 'delete'; title: string; body: string; confirmLabel: string; error: string | null; busy: boolean } | null;

export function SubscriptionDetailsSheet({ subscription, todayISO, busy, confirm, onClose, onRenew, onEdit, onToggleActive, onDelete, onConfirm, onCancelConfirm }: {
  subscription: SubscriptionRecord | null; todayISO: string; busy: boolean;
  /** A renew or delete confirmation shown inside the sheet (no second modal, which iOS may refuse while one is closing). */
  confirm: SheetConfirm;
  onClose: () => void; onRenew: () => void; onEdit: () => void; onToggleActive: () => void; onDelete: () => void; onConfirm: () => void; onCancelConfirm: () => void;
}) {
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const insets = useSafeAreaInsets();
  const visible = subscription !== null;
  // Keep showing the last plan while the sheet slides away after closing.
  const [last, setLast] = useState(subscription);
  if (subscription && subscription !== last) setLast(subscription);
  const shown = subscription ?? last;
  const { opening, offset, reduceMotion, headerHandlers } = useSheetDrag(visible, onClose);
  if (!shown) return null;

  const status = shown.is_active ? renewalStatus(shown.next_billing_date, shown.reminder_days_before, todayISO) : 'later';
  const statusText = !shown.is_active ? t('subscription.pausedBadge') : status === 'later' ? t('subscription.onSchedule') : shortRenewalStatus(status, shown.next_billing_date, todayISO, t);
  const tone = status === 'overdue' ? tokens.cardErrorText : status === 'today' ? tokens.cardWarningText : status === 'soon' ? tokens.brandCyan : tokens.cardMutedText;
  const statusIcon: IconName = !shown.is_active ? 'pause-circle-outline' : status === 'later' ? 'checkmark-circle-outline' : statusIcons[status];
  const action = (key: string, icon: IconName, label: string, a11y: string, onPress: () => void, variant: 'primary' | 'plain' | 'danger' = 'plain') => {
    const colour = variant === 'danger' ? tokens.cardErrorText : variant === 'primary' ? tokens.cardText : tokens.cardText;
    return <Pressable key={key} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ disabled: busy }} disabled={busy} onPress={onPress}
      style={({ pressed }) => [styles.action, variant === 'primary' ? [styles.primaryAction, { backgroundColor: tokens.brandBlue }] : { backgroundColor: tokens.cardElevated, borderColor: tokens.border, borderWidth: 1 }, pressed && styles.pressed]}>
      <Ionicons name={icon} size={18} color={variant === 'primary' ? tokens.cardText : variant === 'danger' ? tokens.cardErrorText : tokens.brandCyan} />
      <Text style={[styles.actionText, { color: colour }]} numberOfLines={1}>{label}</Text>
    </Pressable>;
  };

  return <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
    <View style={styles.root}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: tokens.modalScrim }]} accessibilityLabel={t('subscription.closeDetails')} onPress={onClose} />
      <Animated.View key={opening} testID="subscription-details" accessibilityViewIsModal aria-modal
        style={[styles.sheet, { backgroundColor: tokens.cardBackground, borderColor: tokens.border, paddingBottom: Math.max(insets.bottom, spacing.space4) + spacing.space2, transform: [{ translateY: offset }] }]}>
        <View {...headerHandlers} testID="subscription-details-drag" style={styles.top}>
          <View style={[styles.handle, { backgroundColor: tokens.border }]} />
          <View style={styles.headerRow}>
            <SubscriptionBrandIcon name={shown.name} size={48} />
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={[styles.title, { color: tokens.cardText }]} numberOfLines={2}>{shown.name}</Text>
              <Text style={[styles.subtitle, { color: tokens.cardMutedText }]}>
                <FinanceNumber style={[styles.amount, { color: tokens.cardText }]}>{formatRinggit(Number(shown.amount))}</FinanceNumber>{' · '}{t(`subscription.frequency.${shown.billing_frequency}`)}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('subscription.closeDetails')} onPress={onClose}
              style={({ pressed }) => [styles.close, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, pressed && styles.pressed]}>
              <Ionicons name="close" size={22} color={tokens.cardText} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.facts, { borderColor: tokens.border }]}>
          <View style={styles.fact}>
            <Text style={[styles.factLabel, { color: tokens.cardMutedText }]}>{t('subscription.nextDate')}</Text>
            <Text testID="subscription-details-date" style={[styles.factValue, { color: tokens.cardText }]}>{formatExpenseDateLong(shown.next_billing_date, language)}</Text>
          </View>
          <View style={styles.fact}>
            <Text style={[styles.factLabel, { color: tokens.cardMutedText }]}>{t('subscription.statusLabel')}</Text>
            <View testID="subscription-details-status" style={styles.statusRow}><Ionicons name={statusIcon} size={16} color={tone} /><Text style={[styles.factValue, { color: tone }]}>{statusText}</Text></View>
          </View>
          {shown.is_active && shown.notifications_enabled && <View style={styles.fact}>
            <Text style={[styles.factLabel, { color: tokens.cardMutedText }]}>{t('subscription.reminderTiming')}</Text>
            <Text style={[styles.factValue, { color: tokens.cardText }]}>{reminderDaysLabel(shown.reminder_days_before, t)}</Text>
          </View>}
          {shown.is_active && !shown.notifications_enabled && <View style={styles.fact}>
            <Text style={[styles.factLabel, { color: tokens.cardMutedText }]}>{t('subscription.reminderTiming')}</Text>
            <Text style={[styles.factValue, { color: tokens.cardMutedText }]}>{t('subscription.reminderOff')}</Text>
          </View>}
        </View>

        {busy && <ActivityIndicator color={tokens.brandCyan} />}
        {confirm ? <View testID={confirm.kind === 'renew' ? 'subscription-renew-dialog' : 'subscription-delete-dialog'} style={styles.confirm} accessibilityLiveRegion="polite">
          <Text style={[styles.confirmTitle, { color: tokens.cardText }]}>{confirm.title}</Text>
          <Text style={[styles.confirmBody, { color: tokens.cardMutedText }]}>{confirm.body}</Text>
          {confirm.error && <Text style={[styles.confirmBody, { color: tokens.cardErrorText }]} accessibilityRole="alert">{confirm.error}</Text>}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: confirm.busy }} disabled={confirm.busy} onPress={onCancelConfirm}
              style={({ pressed }) => [styles.action, { backgroundColor: tokens.cardElevated, borderColor: tokens.border, borderWidth: 1 }, pressed && styles.pressed]}>
              <Text style={[styles.actionText, { color: tokens.cardText }]}>{t('subscription.cancel')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: confirm.busy, busy: confirm.busy }} disabled={confirm.busy} onPress={onConfirm}
              style={({ pressed }) => [styles.action, { backgroundColor: confirm.kind === 'delete' ? tokens.destructiveBackground : tokens.brandBlue }, pressed && styles.pressed]}>
              {confirm.busy ? <ActivityIndicator color={tokens.destructiveForeground} /> : <Text style={[styles.actionText, { color: tokens.destructiveForeground }]}>{confirm.confirmLabel}</Text>}
            </Pressable>
          </View>
        </View> : <View style={styles.actions}>
          {shown.is_active && action('renew', 'refresh-circle-outline', t('subscription.markRenewed'), t('subscription.markRenewedLabel', { name: shown.name }), onRenew, 'primary')}
          {action('edit', 'create-outline', t('subscription.editShort'), t('subscription.open', { name: shown.name }), onEdit)}
          {action('toggle', shown.is_active ? 'pause-circle-outline' : 'play-circle-outline', t(shown.is_active ? 'subscription.pause' : 'subscription.resume'),
            t(shown.is_active ? 'subscription.pauseLabel' : 'subscription.resumeLabel', { name: shown.name }), onToggleActive)}
          {action('delete', 'trash-outline', t('subscription.deleteShort'), t('subscription.delete'), onDelete, 'danger')}
        </View>}
      </Animated.View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 568, alignSelf: 'center', borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: spacing.space5, gap: spacing.space4 },
  top: { paddingTop: spacing.space3, gap: spacing.space3 },
  handle: { width: 40, height: 4, borderRadius: radius.radiusFull, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.sectionTitle }, subtitle: { ...typography.label }, amount: { fontSize: 14 },
  close: { width: 44, height: 44, borderRadius: radius.radiusFull, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  facts: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: spacing.space3, gap: spacing.space3 },
  fact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space3 },
  factLabel: { ...typography.label }, factValue: { ...typography.body, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space1, flexShrink: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2 },
  // The primary action takes a full row so its label never truncates; the others share rows below.
  primaryAction: { flexBasis: '100%' },
  action: { flexGrow: 1, flexBasis: '30%', minHeight: 48, borderRadius: radius.radiusMd, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2, paddingHorizontal: spacing.space3 },
  actionText: { ...typography.body, fontWeight: '600' },
  pressed: { opacity: 0.75 },
  confirm: { gap: spacing.space3 }, confirmTitle: { ...typography.body, fontWeight: '700' }, confirmBody: { ...typography.body, lineHeight: 22 },
});
