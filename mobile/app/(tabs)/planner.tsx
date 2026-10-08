import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { radius, spacing, typography } from '@/constants/theme';
import { isReminderOffset, reminderLabelKey } from '@/lib/reminderMath';
import { formatTaskDeadline, isOverdue, sortTasks } from '@/lib/tasks';
import type { TaskRecord } from '@/lib/tasks';
import { supabase } from '@/lib/supabase';
import { syncTaskReminders } from '@/lib/taskReminders';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error';
const PAGE_SIZE = 500;

export default function PlannerScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const insets = useSafeAreaInsets();
  const { saved, updated, deleted, statusChanged, reminderIssue } = useLocalSearchParams<{ saved?: string; updated?: string; deleted?: string; statusChanged?: string; reminderIssue?: string }>();
  const [state, setState] = useState<LoadState>('loading');
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [localReminderIssue, setLocalReminderIssue] = useState<string | null>(null);
  const version = useRef(0);

  const loadTasks = useCallback(async (refresh = false) => {
    const request = ++version.current;
    if (refresh) setRefreshing(true);
    else setState('loading');
    if (!userId) { setState('error'); setRefreshing(false); return; }
    try {
      const loaded: TaskRecord[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase.from('tasks').select('*')
          .eq('user_id', userId).order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
        if (request !== version.current) return;
        if (error) throw error;
        const page = (data ?? []) as TaskRecord[];
        loaded.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      setTasks(sortTasks(loaded));
      setState('ready');
    } catch {
      if (request === version.current) { setTasks([]); setState('error'); }
    } finally {
      if (request === version.current) setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void loadTasks();
    return () => { ++version.current; };
  }, [loadTasks]));

  async function toggle(task: TaskRecord) {
    if (!userId || busyId) return;
    setBusyId(task.id);
    setStatusError(false);
    setLocalReminderIssue(null);
    const completing = task.status !== 'completed';
    try {
      const { data, error } = await supabase.from('tasks').update({ status: completing ? 'completed' : 'pending', completed_at: completing ? new Date().toISOString() : null })
        .eq('id', task.id).eq('user_id', userId).select('id').maybeSingle();
      if (error || !data) { setStatusError(true); return; }
      const result = task.reminder_offset_minutes != null
        ? await syncTaskReminders(userId, language, !completing) : 'ok';
      if (result !== 'ok' && task.reminder_offset_minutes != null && !(completing && result === 'unsupported')) setLocalReminderIssue(completing ? 'updateError' : result);
      await loadTasks(true);
    } catch { setStatusError(true); }
    finally { setBusyId(null); }
  }

  const feedback = saved ? t('task.saved') : updated ? t('task.updated') : deleted ? t('task.deleted') : statusChanged === 'completed' ? t('task.completedFeedback') : statusChanged === 'reopened' ? t('task.reopenedFeedback') : null;
  const reminderMessage = (localReminderIssue ?? reminderIssue) === 'permissionDenied' ? t('task.reminderPermission')
    : (localReminderIssue ?? reminderIssue) === 'unsupported' ? t('task.reminderWeb')
      : (localReminderIssue ?? reminderIssue) === 'past' ? t('task.reminderPast')
        : (localReminderIssue ?? reminderIssue) === 'updateError' ? t('task.reminderUpdateError')
        : (localReminderIssue ?? reminderIssue) === 'error' ? t('task.reminderUnavailable') : null;
  return <FlatList
    style={{ backgroundColor: tokens.screenBackground }}
    contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space6 }]}
    data={state === 'ready' ? tasks : []}
    keyExtractor={(item) => item.id}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadTasks(true); }} tintColor={tokens.brandCyan} colors={[tokens.brandBlue]} />}
    ListHeaderComponent={<View style={styles.header}>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('task.eyebrow')}</Text>
      <Text style={[styles.heading, { color: tokens.screenText }]}>{t('task.heading')}</Text>
      <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('task.helper')}</Text>
      <PrimaryButton onPress={() => router.push('/add-task')}>{t('task.add')}</PrimaryButton>
      <Pressable accessibilityRole="button" onPress={() => router.push('/my-semester')} style={[styles.semesterLink, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Ionicons name="book-outline" size={20} color={tokens.brandCyan} /><Text style={[styles.semesterLinkText, { color: tokens.cardText }]}>{t('semester.title')}</Text><Ionicons name="chevron-forward" size={19} color={tokens.cardMutedText} /></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/reminders')} style={[styles.semesterLink, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Ionicons name="notifications-outline" size={20} color={tokens.brandCyan} /><Text style={[styles.semesterLinkText, { color: tokens.cardText }]}>{t('reminders.title')}</Text><Ionicons name="chevron-forward" size={19} color={tokens.cardMutedText} /></Pressable>
      {feedback && <Text style={[styles.feedback, { color: tokens.successText }]} accessibilityRole="alert">{feedback}</Text>}
      {statusError && <Text style={[styles.feedback, { color: tokens.errorText }]} accessibilityRole="alert">{t('task.statusError')}</Text>}
      {reminderMessage && <Text style={[styles.feedback, { color: tokens.errorText }]} accessibilityRole="alert">{reminderMessage}</Text>}
    </View>}
    ListEmptyComponent={state === 'loading' ? <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><ActivityIndicator color={tokens.brandCyan} size="large" /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('task.loading')}</Text></View>
      : state === 'error' ? <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Text style={[styles.muted, { color: tokens.cardText }]}>{t('task.loadError')}</Text><PrimaryButton onPress={() => { void loadTasks(); }}>{t('task.retry')}</PrimaryButton></View>
        : <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Ionicons name="calendar-outline" size={30} color={tokens.brandCyan} /><Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('task.emptyTitle')}</Text><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('task.emptyBody')}</Text></View>}
    renderItem={({ item }) => {
      const overdue = isOverdue(item);
      return <View style={[styles.taskCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('task.open', { title: item.title })} onPress={() => router.push({ pathname: '/task-detail', params: { id: item.id } })} style={styles.taskMain}>
          <View style={styles.cardTop}><Text style={[styles.taskTitle, { color: tokens.cardText }]} numberOfLines={2}>{item.title}</Text><Ionicons name="chevron-forward" size={20} color={tokens.cardMutedText} /></View>
          <Text style={[styles.subject, { color: tokens.cardMutedText }]} numberOfLines={1}>{item.subject}</Text>
          <View style={styles.meta}><Text style={[styles.badge, { color: tokens.brandCyan, backgroundColor: tokens.cardElevated }]}>{t(`task.${item.priority}`)}</Text><Text style={[styles.badge, { color: tokens.cardText, backgroundColor: tokens.cardElevated }]}>{t(`task.${item.status}`)}</Text>{overdue && <Text style={[styles.badge, { color: tokens.cardErrorText, backgroundColor: tokens.cardElevated }]}>{t('task.overdue')}</Text>}</View>
          <Text style={[styles.deadline, { color: overdue ? tokens.cardErrorText : tokens.cardMutedText }]}>{formatTaskDeadline(item.deadline, language)}</Text>
          {item.reminder_offset_minutes != null && isReminderOffset(item.reminder_offset_minutes) && <View style={styles.reminderRow}><Ionicons name="notifications-outline" size={15} color={tokens.brandCyan} /><Text style={[styles.reminderText, { color: tokens.cardMutedText }]}>{t(reminderLabelKey(item.reminder_offset_minutes))}</Text></View>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t(item.status === 'completed' ? 'task.reopenLabel' : 'task.completeLabel', { title: item.title })} accessibilityState={{ disabled: !!busyId, busy: busyId === item.id }} disabled={!!busyId} onPress={() => { void toggle(item); }} style={[styles.complete, { borderTopColor: tokens.border }]}>
          {busyId === item.id ? <ActivityIndicator color={tokens.brandCyan} /> : <Ionicons name={item.status === 'completed' ? 'refresh-circle-outline' : 'checkmark-circle-outline'} size={23} color={tokens.brandCyan} />}
          <Text style={[styles.completeText, { color: tokens.brandCyan }]}>{t(item.status === 'completed' ? 'task.reopen' : 'task.markComplete')}</Text>
        </Pressable>
      </View>;
    }}
  />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.space6, paddingBottom: 112, width: '100%', maxWidth: 568, alignSelf: 'center' },
  header: { marginBottom: spacing.space5 }, eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 }, heading: { ...typography.screenTitle, marginBottom: spacing.space2 }, helper: { ...typography.body, lineHeight: 23, marginBottom: spacing.space6 },
  feedback: { ...typography.label, marginTop: spacing.space4 }, card: { borderRadius: radius.radiusLg, borderWidth: 1, padding: spacing.space6, gap: spacing.space4 }, cardTitle: { ...typography.sectionTitle }, muted: { ...typography.body, lineHeight: 23 },
  taskCard: { borderRadius: radius.radiusLg, borderWidth: 1, marginBottom: spacing.space3, overflow: 'hidden' }, taskMain: { padding: spacing.space5, gap: spacing.space2, minHeight: 118 }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2 }, taskTitle: { ...typography.sectionTitle, flex: 1 }, subject: { ...typography.body }, meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2, marginTop: spacing.space2 }, badge: { ...typography.label, borderRadius: radius.radiusFull, paddingHorizontal: spacing.space3, paddingVertical: spacing.space1, overflow: 'hidden' }, deadline: { ...typography.label, marginTop: spacing.space2 },
  complete: { borderTopWidth: 1, minHeight: 54, paddingHorizontal: spacing.space5, flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }, completeText: { ...typography.label }, reminderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }, reminderText: { ...typography.label },
  semesterLink: { minHeight: 54, borderWidth: 1, borderRadius: radius.radiusMd, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingHorizontal: spacing.space4, marginTop: spacing.space3 }, semesterLinkText: { ...typography.body, fontWeight: '600', flex: 1 },
});
