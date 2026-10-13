import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconQuickActions } from '@/components/IconQuickActions';
import { InsightDeck } from '@/components/home/InsightDeck';
import { AllTasksSheet } from '@/components/planner/AllTasksSheet';
import { FocusDeckCard, NextClassDeckCard, SemesterDeckCard } from '@/components/planner/StudiesCards';
import type { Loadable } from '@/components/planner/StudiesCards';
import { TaskRow } from '@/components/planner/TaskRow';
import { radius, spacing, typography } from '@/constants/theme';
import { loadStudentCourses, readSemesterChoice } from '@/lib/semesterCourses';
import type { SemesterChoice, StudentSemesterCourse } from '@/lib/semesterCourses';
import { PRIORITY_PREVIEW_LIMIT, academicFocus, priorityTasks } from '@/lib/studiesOverview';
import { sortTasks } from '@/lib/tasks';
import type { TaskRecord } from '@/lib/tasks';
import { supabase } from '@/lib/supabase';
import { syncTaskReminders } from '@/lib/taskReminders';
import type { TimetableEntry } from '@/lib/timetable';
import { loadTimetableEntries } from '@/lib/timetableEntries';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error';
const PAGE_SIZE = 500;

/**
 * Studies main page (2026-10-13 revamp, matching Wallet): a compact header, the Studies deck (Academic focus, Today's next class, Semester) with
 * the four icon shortcuts (Add task, My semester, My timetable, Reminders) below it, and
 * stable direct selection (Academic focus first, on the brand gradient), then Priority tasks: at most five incomplete tasks in `priorityTasks` order, with
 * "View all (N)" opening every task in a sheet. Task loading, completing/reopening, and every route are unchanged.
 */

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
  // Read on focus and refresh, so overdue, due-today, and "starts in" follow the device clock without ticking.
  const [now, setNow] = useState(() => new Date());
  // null value: no semester chosen yet (or classes unavailable), shown as a calm empty card rather than an error.
  const [classes, setClasses] = useState<Loadable<TimetableEntry[] | null>>({ state: 'loading' });
  const [semester, setSemester] = useState<Loadable<{ choice: SemesterChoice; courses: StudentSemesterCourse[] } | null>>({ state: 'loading' });
  const [allOpen, setAllOpen] = useState(false);

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
    setNow(new Date());
    void loadTasks();
    return () => { ++version.current; };
  }, [loadTasks]));

  // The next class and the subjects come from the semester last chosen in My semester or My timetable.
  // A failed timetable read shows the calm "no upcoming classes" card, as before; subjects show a calm note.
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!userId) { setClasses({ state: 'ready', value: null }); setSemester({ state: 'error' }); return; }
    void readSemesterChoice(userId).then(async (choice) => {
      if (!active) return;
      if (!choice) { setClasses({ state: 'ready', value: null }); setSemester({ state: 'ready', value: null }); return; }
      const [rows, courses] = await Promise.allSettled([loadTimetableEntries(userId, choice), loadStudentCourses(userId, choice)]);
      if (!active) return;
      setClasses({ state: 'ready', value: rows.status === 'fulfilled' ? rows.value : null });
      setSemester(courses.status === 'fulfilled' ? { state: 'ready', value: { choice, courses: courses.value } } : { state: 'error' });
    });
    return () => { active = false; };
  }, [userId]));

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
  const preview = state === 'ready' ? priorityTasks(tasks, now).slice(0, PRIORITY_PREVIEW_LIMIT) : [];
  const openTask = (task: TaskRecord) => router.push({ pathname: '/task-detail', params: { id: task.id } });
  const addTask = () => router.push('/add-task');
  const card = [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];
  const focus: Loadable<ReturnType<typeof academicFocus>> = state === 'ready' ? { state, value: academicFocus(tasks, now) } : { state };

  return <>
    <ScrollView style={{ backgroundColor: tokens.screenBackground }} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setNow(new Date()); void loadTasks(true); }} tintColor={tokens.brandCyan} colors={[tokens.brandBlue]} />}>
      {/* 1. Compact header: eyebrow and title only. */}
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('task.eyebrow')}</Text>
      <Text accessibilityRole="header" style={[styles.heading, { color: tokens.screenText }]}>{t('task.heading')}</Text>

      {feedback && <Text style={[styles.feedback, { color: tokens.successText }]} accessibilityRole="alert">{feedback}</Text>}
      {statusError && <Text style={[styles.feedback, { color: tokens.errorText }]} accessibilityRole="alert">{t('task.statusError')}</Text>}
      {reminderMessage && <Text style={[styles.feedback, { color: tokens.errorText }]} accessibilityRole="alert">{reminderMessage}</Text>}

      {/* 2. Studies deck, as Wallet's Finance deck: Academic focus is the main card on the brand gradient, with the
          guide; Today and Semester wait behind it on the dark card surface. */}
      <InsightDeck testID="studies-deck" hint={t('studies.deckHint')}
        dotLabel={(item, position, total) => t('studies.deckDot', { name: item.name, position: position + 1, total })}
        cards={[
          { key: 'tasks', name: t('studies.cardTasks'), surface: 'hero', render: () => <FocusDeckCard focus={focus} /> },
          { key: 'today', name: t('studies.cardToday'), surface: 'plain', render: () => <NextClassDeckCard classes={classes} now={now} onOpenTimetable={() => router.push('/timetable')} /> },
          { key: 'semester', name: t('studies.cardSemester'), surface: 'plain', render: () => <SemesterDeckCard semester={semester} onOpenSemester={() => router.push('/my-semester')} /> },
        ]} />

      {/* 3. Icon shortcuts to the existing screens, below the deck as on Wallet. */}
      <View testID="planner-quick-actions"><IconQuickActions testIDPrefix="planner-quick" actions={[
        { key: 'add', icon: 'add', label: t('task.add'), a11y: t('task.add'), onPress: addTask, primary: true },
        { key: 'semester', icon: 'book-outline', label: t('studies.actionSemester'), a11y: t('semester.title'), onPress: () => router.push('/my-semester') },
        { key: 'timetable', icon: 'grid-outline', label: t('studies.actionTimetable'), a11y: t('timetable.title'), onPress: () => router.push('/timetable') },
        { key: 'reminders', icon: 'notifications-outline', label: t('reminders.title'), a11y: t('reminders.title'), onPress: () => router.push('/reminders') },
      ]} /></View>

      {/* 4. Priority tasks: incomplete only, at most five, in one grouped card. */}
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: tokens.screenText }]}>{t('studies.priorityTitle')}</Text>
        {state === 'ready' && tasks.length > 0 && <Pressable testID="view-all-tasks" accessibilityRole="button" accessibilityLabel={t('studies.viewAllA11y', { count: tasks.length })}
          accessibilityHint={t('studies.viewAllHint')} onPress={() => setAllOpen(true)} style={({ pressed }) => [styles.viewAll, pressed && styles.pressed]}>
          <Text style={[styles.viewAllText, { color: tokens.pageAccent }]}>{t('studies.viewAll', { count: tasks.length })}</Text>
          <Ionicons name="chevron-forward" size={16} color={tokens.pageAccent} />
        </Pressable>}
      </View>
      {state === 'loading' ? <View style={card}><ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('task.loading')}</Text></View>
        : state === 'error' ? <View style={card}>
          <Text style={[styles.muted, { color: tokens.cardText }]} accessibilityRole="alert">{t('task.loadError')}</Text>
          <Pressable accessibilityRole="button" onPress={() => { void loadTasks(); }} style={styles.retry}><Text style={[styles.retryText, { color: tokens.brandCyan }]}>{t('task.retry')}</Text></Pressable>
        </View>
          : preview.length === 0 ? <View testID="priority-empty" style={card}>
            <Ionicons name={tasks.length ? 'checkmark-done-circle-outline' : 'calendar-outline'} size={28} color={tokens.brandCyan} />
            <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{tasks.length ? t('studies.caughtUp') : t('task.emptyTitle')}</Text>
            <Text style={[styles.muted, { color: tokens.cardMutedText }]}>{tasks.length ? t('studies.caughtUpBody') : t('task.emptyBody')}</Text>
            <Pressable testID="priority-add" accessibilityRole="button" accessibilityLabel={t('studies.addFirst')} onPress={addTask}
              style={({ pressed }) => [styles.addFirst, { backgroundColor: tokens.brandBlue }, pressed && styles.pressed]}>
              <Ionicons name="add" size={18} color={tokens.actionInk} /><Text style={[styles.addFirstText, { color: tokens.actionInk }]}>{t('studies.addFirst')}</Text>
            </Pressable>
          </View>
            : <View testID="priority-tasks">{preview.map((task, index) => <TaskRow key={task.id} task={task} now={now} first={index === 0} last={index === preview.length - 1}
              busy={busyId === task.id} disabled={!!busyId} onOpen={() => openTask(task)} onToggle={() => { void toggle(task); }} />)}</View>}
    </ScrollView>
    <AllTasksSheet visible={allOpen} tasks={tasks} state={state} now={now} refreshing={refreshing} busyId={busyId}
      onRefresh={() => { setNow(new Date()); void loadTasks(true); }} onClose={() => setAllOpen(false)}
      // iOS refuses to present a screen over an open modal, so the sheet closes first.
      onOpenTask={(task) => { setAllOpen(false); openTask(task); }} onToggle={(task) => { void toggle(task); }} />
  </>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.space6, paddingBottom: 112, gap: spacing.space3, width: '100%', maxWidth: 568, alignSelf: 'center' },
  eyebrow: { ...typography.label, letterSpacing: 2 }, heading: { ...typography.screenTitle, marginBottom: spacing.space2 },
  feedback: { ...typography.label },
  card: { borderRadius: radius.radiusLg, borderWidth: 1, padding: spacing.space5, gap: spacing.space3 }, cardTitle: { ...typography.sectionTitle }, muted: { ...typography.body, lineHeight: 23 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space2, marginTop: spacing.space3 },
  sectionTitle: { ...typography.sectionTitle },
  viewAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: spacing.space2 },
  viewAllText: { ...typography.label, fontWeight: '700' }, pressed: { opacity: 0.7 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, retryText: { ...typography.body, fontWeight: '600' },
  addFirst: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space1, borderRadius: radius.radiusMd, paddingHorizontal: spacing.space4 },
  addFirstText: { ...typography.body, fontWeight: '700' },
});
