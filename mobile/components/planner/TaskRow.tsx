import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/constants/theme';
import { deadlineTime, taskUrgency } from '@/lib/studiesOverview';
import { formatTaskDeadline } from '@/lib/tasks';
import type { TaskRecord } from '@/lib/tasks';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * One compact task row in a grouped card, as Wallet's Recent expenses rows: `first` and `last` round the card,
 * and a hairline separates rows. The leading circle keeps the Planner's existing complete/reopen action; the rest
 * of the row opens the task. Overdue and due-today are written out (never colour alone); completed shows only in
 * the full list, because Priority tasks never contains completed tasks.
 */
export function TaskRow({ task, now, first = true, last = true, busy, disabled, onOpen, onToggle }: {
  task: TaskRecord; now: Date; first?: boolean; last?: boolean; busy: boolean; disabled: boolean; onOpen: () => void; onToggle: () => void;
}) {
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const completed = task.status === 'completed';
  const urgency = taskUrgency(task, now);
  const due = deadlineTime(task) === null ? t('studies.noDueDate') : formatTaskDeadline(task.deadline, language);
  const priority = t(`task.${task.priority}`);
  const status = completed ? t('task.completed') : urgency === 'overdue' ? t('task.overdue') : urgency === 'today' ? t('studies.dueToday') : null;
  const statusColour = urgency === 'overdue' ? tokens.cardErrorText : urgency === 'today' ? tokens.cardWarningText : tokens.cardMutedText;

  return <View testID={`task-row-${task.id}`} style={[styles.row, { backgroundColor: tokens.cardBackground, borderColor: tokens.border },
    first ? styles.first : { borderTopWidth: StyleSheet.hairlineWidth }, last && styles.last]}>
    <Pressable accessibilityRole="button" accessibilityLabel={t(completed ? 'task.reopenLabel' : 'task.completeLabel', { title: task.title })}
      accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onToggle} style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator color={tokens.brandCyan} />
        : <Ionicons name={completed ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={completed ? tokens.brandCyan : tokens.cardMutedText} />}
    </Pressable>
    <Pressable accessibilityRole="button" onPress={onOpen}
      accessibilityLabel={`${t('task.open', { title: task.title })}. ${[task.subject, due, t('studies.priorityA11y', { priority }), status].filter(Boolean).join(', ')}`}
      style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: tokens.cardText }, completed && styles.done]} numberOfLines={1}>{task.title}</Text>
        {!!task.subject && <Text style={[styles.meta, { color: tokens.cardMutedText }]} numberOfLines={1}>{task.subject}</Text>}
        <View style={styles.badges}>
          {status && <View style={[styles.badge, { backgroundColor: tokens.cardElevated }]}>
            {urgency && <Ionicons name={urgency === 'overdue' ? 'alert-circle-outline' : 'today-outline'} size={13} color={statusColour} />}
            <Text style={[styles.badgeText, { color: statusColour }]}>{status}</Text>
          </View>}
          <View style={[styles.badge, { backgroundColor: tokens.cardElevated }]}>
            <Ionicons name="flag-outline" size={12} color={tokens.brandCyan} />
            <Text style={[styles.badgeText, { color: tokens.brandCyan }]}>{priority}</Text>
          </View>
          <Text style={[styles.meta, styles.due, { color: urgency === 'overdue' ? tokens.cardErrorText : tokens.cardMutedText }]}>{due}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={tokens.cardMutedText} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.space1, paddingRight: spacing.space3, borderLeftWidth: 1, borderRightWidth: 1 },
  first: { borderTopWidth: 1, borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg },
  last: { borderBottomWidth: 1, borderBottomLeftRadius: radius.radiusLg, borderBottomRightRadius: radius.radiusLg },
  toggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingVertical: spacing.space3 },
  pressed: { opacity: 0.7 },
  content: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.body, fontWeight: '600' }, done: { textDecorationLine: 'line-through' },
  meta: { ...typography.label }, due: { flexShrink: 1 },
  badges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.space2, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.radiusFull, paddingHorizontal: spacing.space2, paddingVertical: 2 },
  badgeText: { ...typography.label, fontSize: 12, fontWeight: '600' },
});
