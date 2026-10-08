import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { TranslationKey } from '@/constants/i18n';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];
export type QuickActionId = 'addExpense' | 'scanReceipt' | 'addTask' | 'logMood';
export type QuickAction = { id: QuickActionId; icon: IconName; title: TranslationKey; description: TranslationKey };

// The four shortcuts named in UNIFYD_DESIGN_SYSTEM.md (Bottom navigation).
export const QUICK_ACTIONS: readonly QuickAction[] = [
  { id: 'addExpense', icon: 'create-outline', title: 'quick.addExpense', description: 'quick.addExpenseHint' },
  { id: 'scanReceipt', icon: 'camera-outline', title: 'quick.scanReceipt', description: 'quick.scanReceiptHint' },
  { id: 'addTask', icon: 'checkbox-outline', title: 'quick.addTask', description: 'quick.addTaskHint' },
  { id: 'logMood', icon: 'heart-outline', title: 'quick.logMood', description: 'quick.logMoodHint' },
];

/** Centre tab-bar button; the + rotates into × while the sheet is open. */
export function QuickActionsButton({ open, progress, onPress }: { open: boolean; progress: Animated.Value; onPress: () => void }) {
  const { t } = useI18n();
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });
  return (
    <View style={styles.buttonSlot}>
      <Pressable accessibilityRole="button" accessibilityLabel={t(open ? 'quick.close' : 'quick.open')} accessibilityState={{ expanded: open }}
        onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Animated.View style={{ transform: [{ rotate }] }}><Ionicons name="add" size={30} color={colors.white} /></Animated.View>
      </Pressable>
    </View>
  );
}

/** Sheet above the tab bar; the bar stays visible so the × closes it in place. */
export function QuickActionsSheet({ open, progress, bottom, onClose, onSelect }: {
  open: boolean; progress: Animated.Value; bottom: number; onClose: () => void; onSelect: (id: QuickActionId) => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  return (
    <View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { bottom }]} accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.modalScrim, opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('quick.close')} onPress={onClose} />
      </Animated.View>
      <Animated.View testID="quick-actions-sheet" style={[styles.sheet, { backgroundColor: tokens.cardBackground, borderColor: tokens.border, opacity: progress, transform: [{ translateY }] }]}>
        <View style={[styles.handle, { backgroundColor: tokens.border }]} />
        <Text style={[styles.title, { color: tokens.cardText }]}>{t('quick.title')}</Text>
        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable key={action.id} accessibilityRole="button" accessibilityLabel={t(action.title)} accessibilityHint={t(action.description)}
              onPress={() => onSelect(action.id)}
              style={({ pressed }) => [styles.tile, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, pressed && styles.pressed]}>
              <View style={[styles.iconWrap, { backgroundColor: tokens.cardBackground }]}><Ionicons name={action.icon} size={24} color={tokens.brandCyan} /></View>
              <Text style={[styles.tileTitle, { color: tokens.cardText }]}>{t(action.title)}</Text>
              <Text style={[styles.tileHint, { color: tokens.cardMutedText }]}>{t(action.description)}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  button: {
    width: 52, height: 52, borderRadius: radius.radiusFull, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brandBlue,
    shadowColor: colors.brandBlue, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  pressed: { opacity: 0.85 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', maxWidth: 568, alignSelf: 'center',
    borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg, borderWidth: 1, borderBottomWidth: 0,
    paddingHorizontal: spacing.space5, paddingTop: spacing.space3, paddingBottom: spacing.space6, gap: spacing.space4,
  },
  handle: { width: 40, height: 4, borderRadius: radius.radiusFull, alignSelf: 'center' },
  title: { ...typography.sectionTitle },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space3 },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 132, borderRadius: radius.radiusMd, borderWidth: 1, padding: spacing.space4, alignItems: 'center', justifyContent: 'center', gap: spacing.space2 },
  iconWrap: { width: 52, height: 52, borderRadius: radius.radiusFull, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { ...typography.body, fontWeight: '700', textAlign: 'center' },
  tileHint: { ...typography.label, textAlign: 'center', lineHeight: 17 },
});
