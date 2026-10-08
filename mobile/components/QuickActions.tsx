import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { TranslationKey } from '@/constants/i18n';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { DEFAULT_QUICK_ACTIONS, MAX_QUICK_ACTIONS, QUICK_ACTION_IDS, toggleQuickAction } from '@/lib/quickActions';
import type { QuickActionId } from '@/lib/quickActions';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];
type QuickAction = { icon: IconName; title: TranslationKey; description: TranslationKey };

const ACTIONS: Record<QuickActionId, QuickAction> = {
  addExpense: { icon: 'create-outline', title: 'quick.addExpense', description: 'quick.addExpenseHint' },
  scanReceipt: { icon: 'camera-outline', title: 'quick.scanReceipt', description: 'quick.scanReceiptHint' },
  setBudget: { icon: 'pie-chart-outline', title: 'quick.setBudget', description: 'quick.setBudgetHint' },
  addTask: { icon: 'checkbox-outline', title: 'quick.addTask', description: 'quick.addTaskHint' },
  reminders: { icon: 'notifications-outline', title: 'quick.reminders', description: 'quick.remindersHint' },
  mySemester: { icon: 'book-outline', title: 'quick.mySemester', description: 'quick.mySemesterHint' },
  logMood: { icon: 'heart-outline', title: 'quick.logMood', description: 'quick.logMoodHint' },
};

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
export function QuickActionsSheet({ open, progress, bottom, actions, onClose, onSelect, onSave }: {
  open: boolean; progress: Animated.Value; bottom: number; actions: readonly QuickActionId[];
  onClose: () => void; onSelect: (id: QuickActionId) => void; onSave: (ids: QuickActionId[]) => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [draft, setDraft] = useState<QuickActionId[] | null>(null);
  const [notice, setNotice] = useState<'limit' | 'minimum' | null>(null);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  function toggle(id: QuickActionId) {
    if (!draft) return;
    const next = toggleQuickAction(draft, id);
    setNotice(next.length === draft.length ? (draft.includes(id) ? 'minimum' : 'limit') : null);
    setDraft(next);
  }

  return (
    <View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { bottom }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.modalScrim, opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('quick.close')} onPress={onClose} />
      </Animated.View>
      <Animated.View testID="quick-actions-sheet" style={[styles.sheet, { backgroundColor: tokens.cardBackground, borderColor: tokens.border, opacity: progress, transform: [{ translateY }] }]}>
        <View style={[styles.handle, { backgroundColor: tokens.border }]} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: tokens.cardText }]}>{t(draft ? 'quick.editTitle' : 'quick.title')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t(draft ? 'quick.done' : 'quick.edit')}
            onPress={() => { if (draft) onSave(draft); setDraft(draft ? null : [...actions]); setNotice(null); }} style={styles.textButton}>
            <Text style={[styles.textButtonLabel, { color: tokens.brandCyan }]}>{t(draft ? 'quick.done' : 'quick.edit')}</Text>
          </Pressable>
        </View>

        {!draft ? (
          <View style={styles.grid}>
            {actions.map((id) => (
              <Pressable key={id} accessibilityRole="button" accessibilityLabel={t(ACTIONS[id].title)} accessibilityHint={t(ACTIONS[id].description)}
                onPress={() => onSelect(id)}
                style={({ pressed }) => [styles.tile, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, pressed && styles.pressed]}>
                <View style={[styles.iconWrap, { backgroundColor: tokens.cardBackground }]}><Ionicons name={ACTIONS[id].icon} size={24} color={tokens.brandCyan} /></View>
                <Text style={[styles.tileTitle, { color: tokens.cardText }]}>{t(ACTIONS[id].title)}</Text>
                <Text style={[styles.tileHint, { color: tokens.cardMutedText }]}>{t(ACTIONS[id].description)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <>
            <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('quick.editHint', { max: MAX_QUICK_ACTIONS })}</Text>
            <Text style={[styles.count, { color: tokens.cardText }]}>{t('quick.selectedCount', { count: draft.length, max: MAX_QUICK_ACTIONS })}</Text>
            {notice && <Text style={[styles.notice, { color: colors.warning }]} accessibilityRole="alert">{t(notice === 'limit' ? 'quick.limit' : 'quick.minimum')}</Text>}
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {QUICK_ACTION_IDS.map((id) => {
                const checked = draft.includes(id);
                return (
                  <Pressable key={id} accessibilityRole="checkbox" accessibilityLabel={t(ACTIONS[id].title)} accessibilityState={{ checked }} aria-checked={checked}
                    onPress={() => toggle(id)}
                    style={({ pressed }) => [styles.row, { backgroundColor: tokens.cardElevated, borderColor: checked ? tokens.brandCyan : tokens.border }, pressed && styles.pressed]}>
                    <Ionicons name={ACTIONS[id].icon} size={22} color={tokens.brandCyan} />
                    <View style={styles.rowCopy}>
                      <Text style={[styles.rowTitle, { color: tokens.cardText }]}>{t(ACTIONS[id].title)}</Text>
                      <Text style={[styles.tileHint, { color: tokens.cardMutedText, textAlign: 'left' }]}>{t(ACTIONS[id].description)}</Text>
                    </View>
                    <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? tokens.brandCyan : tokens.cardMutedText} />
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => { setDraft([...DEFAULT_QUICK_ACTIONS]); setNotice(null); }} style={styles.textButton}>
              <Text style={[styles.textButtonLabel, { color: tokens.cardMutedText }]}>{t('quick.reset')}</Text>
            </Pressable>
          </>
        )}
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
    position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', maxWidth: 568, maxHeight: '92%', alignSelf: 'center',
    borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg, borderWidth: 1, borderBottomWidth: 0,
    paddingHorizontal: spacing.space5, paddingTop: spacing.space3, paddingBottom: spacing.space6, gap: spacing.space4,
  },
  handle: { width: 40, height: 4, borderRadius: radius.radiusFull, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space3 },
  title: { ...typography.sectionTitle, flex: 1 },
  textButton: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  textButtonLabel: { ...typography.body, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space3 },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 132, borderRadius: radius.radiusMd, borderWidth: 1, padding: spacing.space4, alignItems: 'center', justifyContent: 'center', gap: spacing.space2 },
  iconWrap: { width: 52, height: 52, borderRadius: radius.radiusFull, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { ...typography.body, fontWeight: '700', textAlign: 'center' },
  tileHint: { ...typography.label, textAlign: 'center', lineHeight: 17 },
  hint: { ...typography.label, lineHeight: 18, marginTop: -spacing.space2 },
  count: { ...typography.label, fontWeight: '700' },
  notice: { ...typography.label, lineHeight: 18 },
  list: { flexGrow: 0 },
  listContent: { gap: spacing.space2 },
  row: { minHeight: 60, borderRadius: radius.radiusMd, borderWidth: 1, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3, flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, fontWeight: '700' },
});
