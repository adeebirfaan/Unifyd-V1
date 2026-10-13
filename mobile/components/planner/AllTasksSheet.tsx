import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Animated, Modal, Pressable, RefreshControl, SectionList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaskRow } from '@/components/planner/TaskRow';
import { radius, spacing, typography } from '@/constants/theme';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { completedTasks, priorityTasks } from '@/lib/studiesOverview';
import type { TaskRecord } from '@/lib/tasks';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * Every task in a near-full-height sheet over Studies (no new route), following Wallet's All expenses sheet:
 * the same drag-to-close (`useSheetDrag`), close button, backdrop, Android back, and Reduce Motion behaviour.
 * Two groups from the tasks Planner already loaded: To do in the Priority tasks order, then Completed
 * (most recently completed first). Rows keep opening the task and the complete/reopen action. Pull to refresh
 * reloads, and a failed reload offers a retry instead of an empty list.
 */
export function AllTasksSheet({ visible, tasks, state, now, refreshing, busyId, onRefresh, onClose, onOpenTask, onToggle }: {
  visible: boolean; tasks: readonly TaskRecord[]; state: 'loading' | 'ready' | 'error'; now: Date; refreshing: boolean; busyId: string | null;
  onRefresh: () => void; onClose: () => void; onOpenTask: (task: TaskRecord) => void; onToggle: (task: TaskRecord) => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { opening, offset, reduceMotion, headerHandlers, listHandlers, onListScroll } = useSheetDrag(visible, onClose);
  const sections = useMemo(() => {
    const open = priorityTasks(tasks, now);
    const done = completedTasks(tasks);
    return [
      ...(open.length ? [{ key: 'open', title: t('studies.toDo', { count: open.length }), data: open }] : []),
      ...(done.length ? [{ key: 'done', title: t('studies.completedSection', { count: done.length }), data: done }] : []),
    ];
  }, [tasks, now, t]);
  const count = tasks.length;

  return <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
    <View style={styles.root}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: tokens.modalScrim }]} accessibilityLabel={t('studies.closeAll')} onPress={onClose} />
      <Animated.View key={opening} testID="all-tasks-sheet" accessibilityViewIsModal aria-modal
        style={[styles.sheet, { maxHeight: height - insets.top - spacing.space6, backgroundColor: tokens.cardBackground, borderColor: tokens.border, transform: [{ translateY: offset }] }]}>
        <View testID="all-tasks-drag" {...headerHandlers} style={styles.top}>
          <View style={[styles.handle, { backgroundColor: tokens.border }]} />
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={[styles.title, { color: tokens.cardText }]}>{t('studies.allTasks')}</Text>
              <Text style={[styles.subtitle, { color: tokens.cardMutedText }]}>{count === 1 ? t('studies.tasksOne') : t('studies.tasksMany', { count })}</Text>
            </View>
            <Pressable testID="all-tasks-close" accessibilityRole="button" accessibilityLabel={t('studies.closeAll')} onPress={onClose}
              style={({ pressed }) => [styles.close, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, pressed && styles.pressed]}>
              <Ionicons name="close" size={22} color={tokens.cardText} />
            </Pressable>
          </View>
        </View>
        <View {...listHandlers} style={styles.listWrap}>
          <SectionList
            sections={sections}
            keyExtractor={(task) => task.id}
            stickySectionHeadersEnabled
            renderSectionHeader={({ section }) => <Text accessibilityRole="header" style={[styles.section, { color: tokens.cardMutedText, backgroundColor: tokens.cardBackground }]}>{section.title}</Text>}
            renderItem={({ item, index, section }) => <TaskRow task={item} now={now} first={index === 0} last={index === section.data.length - 1}
              busy={busyId === item.id} disabled={!!busyId} onOpen={() => onOpenTask(item)} onToggle={() => onToggle(item)} />}
            ListEmptyComponent={<View style={styles.empty}>
              {state === 'error' ? <>
                <Text style={[styles.emptyText, { color: tokens.cardText }]} accessibilityRole="alert">{t('task.loadError')}</Text>
                <Pressable accessibilityRole="button" onPress={onRefresh} style={styles.retry}><Text style={[styles.retryText, { color: tokens.brandCyan }]}>{t('task.retry')}</Text></Pressable>
              </> : <Text style={[styles.emptyText, { color: tokens.cardMutedText }]}>{t(state === 'loading' ? 'task.loading' : 'studies.noTasksYet')}</Text>}
            </View>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brandCyan} colors={[tokens.brandBlue]} />}
            style={styles.list}
            contentContainerStyle={{ paddingHorizontal: spacing.space4, paddingBottom: Math.max(insets.bottom, spacing.space4) + spacing.space4 }}
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
  section: { ...typography.label, fontWeight: '700', letterSpacing: 1, paddingTop: spacing.space4, paddingBottom: spacing.space2 },
  empty: { paddingVertical: spacing.space6, gap: spacing.space3, alignItems: 'flex-start' },
  emptyText: { ...typography.body, lineHeight: 22 },
  retry: { minHeight: 44, justifyContent: 'center' }, retryText: { ...typography.body, fontWeight: '600' },
  listWrap: { flexShrink: 1 }, list: { flexGrow: 0 },
});
