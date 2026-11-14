import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Screen } from '@/components/Screen';
import { ConfirmDialog } from '@/components/finance/ConfirmDialog';
import { FocusCompanion, FocusReflectionCard } from '@/components/focus/FocusCompanion';
import { FocusDial } from '@/components/focus/FocusDial';
import { FocusPickerSheet } from '@/components/focus/FocusPickerSheet';
import type { FocusPickerOption } from '@/components/focus/FocusPickerSheet';
import { FocusSetup } from '@/components/focus/FocusSetup';
import { TaskPageHeader } from '@/components/planner/TaskPage';
import type { TranslationKey } from '@/constants/i18n';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useFocusSession } from '@/hooks/useFocusSession';
import { loadFocusRecords, readFocusGoal, readPoofHidden, writePoofHidden } from '@/lib/focusHistory';
import { focusSuggestions, insightsFetchSince, mergeFocusRecords, recordFromBlock } from '@/lib/focusInsights';
import type { FocusGoal, FocusRecord } from '@/lib/focusInsights';
import { loadFocusBlocks } from '@/lib/focusStorage';
import type { FocusReflection } from '@/lib/focusStorage';
import { GENERAL_STUDY, MIN_PARTIAL_FOCUS_MS, companionState, elapsedMs, hasActiveBlock, nextBreak, phaseLengthMs } from '@/lib/focusTimer';
import type { FocusNotice } from '@/lib/focusTimer';
import { getFocusSyncStatus, onFocusSyncChange, saveFocusReflection, subscribeFocusSync, syncFocusRounds } from '@/lib/focusSync';
import type { FocusSyncStatus } from '@/lib/focusSync';
import { loadStudentCourses, readSemesterChoice, taskSubject } from '@/lib/semesterCourses';
import type { StudentSemesterCourse } from '@/lib/semesterCourses';
import { supabase } from '@/lib/supabase';
import { formatTaskDeadline } from '@/lib/tasks';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type Loadable<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; value: T };
type OpenTask = { id: string; title: string; subject: string; deadline: string; status: string };
const GENERAL = 'general';
const NO_TASK = 'none';
const NOTICE_TEXT: Record<Exclude<FocusNotice, null>, TranslationKey> = {
  focusDone: 'focus.noticeFocusDone', breakDone: 'focus.noticeBreakDone', partialKept: 'focus.noticePartial', discarded: 'focus.noticeDiscarded',
};

/** One quiet line about where kept rounds are: on this device only, being saved, refused, or synced to the account. */
function syncLine(sync: FocusSyncStatus): { icon: 'cloud-upload-outline' | 'cloud-offline-outline' | 'alert-circle-outline' | 'cloud-done-outline'; key: TranslationKey; count?: number } | null {
  if (sync.rejected > 0) return { icon: 'alert-circle-outline', key: sync.rejected === 1 ? 'focus.syncRejectedOne' : 'focus.syncRejectedMany', count: sync.rejected };
  if (sync.pending > 0 && sync.syncing) return { icon: 'cloud-upload-outline', key: 'focus.syncing' };
  if (sync.pending > 0) return { icon: 'cloud-offline-outline', key: sync.pending === 1 ? 'focus.syncPendingOne' : 'focus.syncPendingMany', count: sync.pending };
  if (sync.syncedThisSession) return { icon: 'cloud-done-outline', key: 'focus.synced' };
  return null;
}

/**
 * Unifyd Focus (Phase 2): a Pomodoro-style timer opened from Planner. The timer itself lives in `lib/focusTimer.ts`
 * (timestamps, not ticks) and is restored from the device by `useFocusSession`, so leaving the screen, locking the
 * phone, or restarting the app never resets it. Subject and task are optional read-only links to the student's own
 * semester subjects and open tasks; the timer never changes a task. Finished blocks are kept on the device for syncing.
 */
export default function FocusScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const { width } = useWindowDimensions();
  const { snapshot, dispatch, catchUp, saveFailed, alertResult, lastCompleted } = useFocusSession(userId, language);
  const sync = useSyncExternalStore(subscribeFocusSync, () => getFocusSyncStatus(userId));
  // The dialog keeps its last content while it fades out; `confirmOpen` alone shows or hides it.
  const [confirm, setConfirm] = useState<{ kind: 'reset' } | { kind: 'end'; keptMinutes: number | null }>({ kind: 'reset' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [picker, setPicker] = useState<'subject' | 'task' | null>(null);
  const [courses, setCourses] = useState<Loadable<StudentSemesterCourse[]>>({ state: 'loading' });
  const [tasks, setTasks] = useState<Loadable<OpenTask[]>>({ state: 'loading' });
  const [allTasks, setAllTasks] = useState(false);
  // Phase 5: recorded rounds and the goal for Poof's ready-state suggestion (null when they could not load, so nothing
  // is guessed), whether Poof is hidden, and which completed round's reflection was answered or skipped.
  const [records, setRecords] = useState<FocusRecord[] | null>(null);
  const [goal, setGoal] = useState<FocusGoal | null>(null);
  const [poofHidden, setPoofHidden] = useState(false);
  const [reflected, setReflected] = useState<{ id: string; answered: boolean } | null>(null);
  const request = useRef(0);

  const loadFacts = useCallback(async () => {
    if (!userId) return;
    const version = request.current;
    const [rows, blocks, savedGoal, hidden] = await Promise.allSettled([
      loadFocusRecords(userId, insightsFetchSince(new Date())), loadFocusBlocks(userId), readFocusGoal(userId), readPoofHidden(userId),
    ]);
    if (version !== request.current) return;
    setRecords(rows.status === 'fulfilled' ? mergeFocusRecords(rows.value, blocks.status === 'fulfilled' ? blocks.value.map(recordFromBlock) : []) : null);
    if (savedGoal.status === 'fulfilled') setGoal(savedGoal.value);
    if (hidden.status === 'fulfilled') setPoofHidden(hidden.value);
  }, [userId]);

  const loadLinks = useCallback(async () => {
    const version = ++request.current;
    setCourses({ state: 'loading' });
    setTasks({ state: 'loading' });
    if (!userId) { setCourses({ state: 'error' }); setTasks({ state: 'error' }); return; }
    const [courseResult, taskResult] = await Promise.allSettled([
      readSemesterChoice(userId).then((choice) => choice ? loadStudentCourses(userId, choice) : []),
      supabase.from('tasks').select('id,title,subject,deadline,status').eq('user_id', userId).neq('status', 'completed')
        .order('deadline', { ascending: true }).limit(200).then(({ data, error }) => { if (error) throw error; return (data ?? []) as OpenTask[]; }),
    ]);
    if (version !== request.current) return;
    setCourses(courseResult.status === 'fulfilled' ? { state: 'ready', value: courseResult.value } : { state: 'error' });
    setTasks(taskResult.status === 'fulfilled' ? { state: 'ready', value: taskResult.value } : { state: 'error' });
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void loadLinks().then(loadFacts);
    if (!userId) return () => { ++request.current; };
    void syncFocusRounds(userId);
    // When a sync saves something (for example right after a round is kept) the facts behind suggestions refresh quietly.
    const unsubscribe = onFocusSyncChange(userId, () => { void loadFacts(); });
    return () => { ++request.current; unsubscribe(); };
  }, [loadLinks, loadFacts, userId]));

  if (!snapshot) {
    return <Screen compact><TaskPageHeader titleKey="focus.title" helperKey="focus.subtitle" />
      <View style={[styles.card, styles.center, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('focus.loading')}</Text>
      </View>
    </Screen>;
  }

  const { state, at } = snapshot;
  const active = hasActiveBlock(state);
  const onBreak = state.phase !== 'focus';
  const locked = state.status !== 'idle';
  const dialSize = Math.max(200, Math.min(260, width - spacing.space6 * 2 - spacing.space5 * 2));
  const breakKind = nextBreak(state);
  const breakMinutes = phaseLengthMs(state.settings, breakKind) / 60_000;
  const courseList = courses.state === 'ready' ? courses.value : [];
  const taskList = tasks.state === 'ready' ? tasks.value : [];
  const subjectTasks = state.link.subjectLabel && !allTasks ? taskList.filter((task) => task.subject === state.link.subjectLabel) : taskList;

  function endSession() {
    if (!active) { dispatch({ type: 'end' }); return; }
    const focus = elapsedMs(state, Date.now());
    setConfirm({ kind: 'end', keptMinutes: focus >= MIN_PARTIAL_FOCUS_MS ? Math.floor(focus / 60_000) : null });
    setConfirmOpen(true);
  }

  function chooseSubject(key: string) {
    const course = courseList.find((item) => item.id === key);
    const subjectLabel = course ? taskSubject(course) : null;
    // A linked task stays only when it belongs to the new subject.
    const keepTask = state.link.taskId && subjectLabel !== null && taskList.find((task) => task.id === state.link.taskId)?.subject === subjectLabel;
    dispatch({ type: 'link', link: { ...(keepTask ? state.link : GENERAL_STUDY), courseId: course?.id ?? null, subjectLabel } });
    setAllTasks(false);
    setPicker(null);
  }

  function chooseTask(key: string) {
    const task = taskList.find((item) => item.id === key);
    if (!task) dispatch({ type: 'link', link: { ...state.link, taskId: null, taskTitle: null } });
    else {
      // The task's own subject becomes the session subject, linked to the semester subject when one matches.
      const course = courseList.find((item) => taskSubject(item) === task.subject);
      dispatch({ type: 'link', link: { courseId: course?.id ?? null, subjectLabel: task.subject, taskId: task.id, taskTitle: task.title } });
    }
    setPicker(null);
  }

  const primary = state.status === 'running' ? { label: t('focus.pause'), icon: 'pause' as const, action: () => dispatch({ type: 'pause' }) }
    : state.status === 'paused' ? { label: t('focus.resume'), icon: 'play' as const, action: () => dispatch({ type: 'resume' }) }
      : { label: state.completedRounds ? t('focus.startNext', { round: state.completedRounds + 1 }) : t('focus.start'), icon: 'play' as const, action: () => dispatch({ type: 'start' }) };
  const secondary: { key: string; label: string; icon: 'refresh' | 'play-skip-forward' | 'stop'; onPress: () => void }[] = [
    ...(active ? [{ key: 'reset', label: t('focus.reset'), icon: 'refresh' as const, onPress: () => { setConfirm({ kind: 'reset' }); setConfirmOpen(true); } }] : []),
    ...(onBreak ? [{ key: 'skip', label: t('focus.skipBreak'), icon: 'play-skip-forward' as const, onPress: () => dispatch({ type: 'skipBreak' }) }] : []),
    ...(active || onBreak || state.completedRounds > 0 ? [{ key: 'end', label: t('focus.end'), icon: 'stop' as const, onPress: endSession }] : []),
  ];
  const syncNote = syncLine(sync);
  // Poof: still while focusing or paused, floating when ready or on a break, celebrating a round just completed here.
  const celebrating = !!lastCompleted && state.notice === 'focusDone' && state.phase !== 'focus';
  const companion = companionState(state, celebrating);
  const suggestion = state.status === 'idle'
    ? focusSuggestions({ now: new Date(at), records, tasks: tasks.state === 'ready' ? tasks.value : null, subjects: courses.state === 'ready' ? courses.value.map(taskSubject) : null, goal, limit: 1 })[0] ?? null
    : null;
  const showReflection = !!lastCompleted && (reflected?.id !== lastCompleted || reflected.answered);
  function togglePoof() {
    const next = !poofHidden;
    setPoofHidden(next);
    if (userId) void writePoofHidden(userId, next).catch(() => undefined);
  }
  function answerReflection(value: FocusReflection) {
    if (!userId || !lastCompleted) return;
    setReflected({ id: lastCompleted, answered: true });
    void saveFocusReflection(userId, lastCompleted, value);
  }
  const alertNote = locked && alertResult !== 'ok'
    ? t(alertResult === 'unsupported' ? 'focus.alertsWeb' : alertResult === 'permissionDenied' ? 'focus.alertsDenied' : 'focus.alertsError') : null;

  const subjectOptions: FocusPickerOption[] = [{ key: GENERAL, label: t('focus.generalStudy') }, ...courseList.map((course) => ({ key: course.id, label: taskSubject(course) }))];
  const taskOptions: FocusPickerOption[] = [{ key: NO_TASK, label: t('focus.noTask') },
    ...subjectTasks.map((task) => ({ key: task.id, label: task.title, detail: allTasks || !state.link.subjectLabel ? task.subject : formatTaskDeadline(task.deadline, language) }))];

  return <>
    <Screen compact>
      <TaskPageHeader titleKey="focus.title" helperKey="focus.subtitle" />
      <View style={styles.stack}>
        {state.notice && <View testID="focus-notice" style={[styles.notice, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <Ionicons name={state.notice === 'discarded' ? 'information-circle-outline' : 'checkmark-circle'} size={20} color={tokens.brandCyan} />
          <Text accessibilityRole="alert" style={[styles.noticeText, { color: tokens.cardText }]}>{t(NOTICE_TEXT[state.notice])}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('focus.dismiss')} onPress={() => dispatch({ type: 'dismissNotice' })} style={styles.dismiss}>
            <Ionicons name="close" size={18} color={tokens.cardMutedText} />
          </Pressable>
        </View>}

        <View style={[styles.card, styles.timerCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <FocusDial state={state} at={at} size={dialSize} onExpire={catchUp} />
          <Pressable testID="focus-primary" accessibilityRole="button" accessibilityLabel={primary.label} onPress={primary.action}
            style={({ pressed }) => [styles.primary, { backgroundColor: tokens.brandBlue }, pressed && styles.pressed]}>
            <Ionicons name={primary.icon} size={20} color={colors.white} />
            <Text style={styles.primaryText}>{primary.label}</Text>
          </Pressable>
          {secondary.length > 0 && <View style={styles.secondaryRow}>
            {secondary.map((item) => <Pressable key={item.key} testID={`focus-${item.key}`} accessibilityRole="button" accessibilityLabel={item.label} onPress={item.onPress}
              style={({ pressed }) => [styles.secondary, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, pressed && styles.pressed]}>
              <Ionicons name={item.icon} size={18} color={tokens.cardText} />
              <Text style={[styles.secondaryText, { color: tokens.cardText }]} numberOfLines={2}>{item.label}</Text>
            </Pressable>)}
          </View>}
          {saveFailed && <Text style={[styles.note, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t('focus.saveFailed')}</Text>}
          {alertNote && <Text testID="focus-alert-note" style={[styles.note, { color: tokens.cardMutedText }]}>{alertNote}</Text>}
        </View>

        <FocusCompanion pose={companion.pose} message={companion.message} suggestion={suggestion} hidden={poofHidden} onToggle={togglePoof}
          onAction={suggestion?.kind === 'dueSoon' ? () => chooseTask(suggestion.taskId) : undefined} />
        {showReflection && <FocusReflectionCard answered={reflected?.id === lastCompleted && reflected.answered} onAnswer={answerReflection}
          onSkip={() => { if (lastCompleted) setReflected({ id: lastCompleted, answered: false }); }} />}

        <View style={styles.stats}>
          <View testID="focus-completed" accessible style={[styles.stat, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
            <Text style={[styles.statLabel, { color: tokens.cardMutedText }]}>{t('focus.completedRounds')}</Text>
            <Text style={[styles.statValue, { color: tokens.cardText }]}>{state.completedRounds}</Text>
          </View>
          <View testID="focus-next-break" accessible style={[styles.stat, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
            <Text style={[styles.statLabel, { color: tokens.cardMutedText }]}>{t('focus.nextBreak')}</Text>
            <Text style={[styles.statSmall, { color: tokens.cardText }]}>{onBreak ? '—' : t(breakKind === 'longBreak' ? 'focus.nextBreakLong' : 'focus.nextBreakShort', { count: breakMinutes })}</Text>
          </View>
        </View>

        <Pressable testID="focus-insights-link" accessibilityRole="button" accessibilityLabel={t('focus.insightsLink')} accessibilityHint={t('focus.insightsLinkHint')}
          onPress={() => router.push('/focus-insights')} style={({ pressed }) => [styles.insights, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }, pressed && styles.pressed]}>
          <Ionicons name="stats-chart-outline" size={20} color={tokens.brandCyan} />
          <View style={styles.insightsCopy}>
            <Text style={[styles.insightsTitle, { color: tokens.cardText }]}>{t('focus.insightsLink')}</Text>
            <Text style={[styles.note, { color: tokens.cardMutedText }]}>{t('focus.insightsLinkHint')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={tokens.cardMutedText} />
        </Pressable>

        {syncNote && <View testID="focus-sync" style={styles.sync}>
          <Ionicons name={syncNote.icon} size={16} color={tokens.mutedText} />
          <Text style={[styles.syncText, { color: tokens.mutedText }]}>{t(syncNote.key, syncNote.count === undefined ? undefined : { count: syncNote.count })}</Text>
        </View>}

        <FocusSetup settings={state.settings} link={state.link} locked={locked}
          onSettings={(settings) => dispatch({ type: 'settings', settings })} onOpenSubject={() => setPicker('subject')} onOpenTask={() => setPicker('task')} />
      </View>
    </Screen>

    <FocusPickerSheet testID="focus-subject-sheet" visible={picker === 'subject'} title={t('focus.chooseSubject')} options={subjectOptions}
      selectedKey={state.link.courseId ?? (state.link.subjectLabel ? '' : GENERAL)} state={courses.state} errorText={t('focus.subjectsError')}
      emptyText={courses.state === 'ready' && !courseList.length ? t('focus.noSubjectsNote') : undefined}
      onSelect={chooseSubject} onRetry={() => { void loadLinks(); }} onClose={() => setPicker(null)} />
    <FocusPickerSheet testID="focus-task-sheet" visible={picker === 'task'} title={t('focus.chooseTask')} options={taskOptions}
      selectedKey={state.link.taskId ?? NO_TASK} state={tasks.state} errorText={t('focus.tasksError')}
      emptyText={tasks.state === 'ready' && !subjectTasks.length ? t(state.link.subjectLabel && !allTasks ? 'focus.noTasksForSubject' : 'focus.noOpenTasks') : undefined}
      footer={state.link.subjectLabel && tasks.state === 'ready' && taskList.length > 0 ? <Pressable testID="focus-task-scope" accessibilityRole="button" onPress={() => setAllTasks((value) => !value)} style={styles.scope}>
        <Text style={[styles.scopeText, { color: tokens.brandCyan }]}>{t(allTasks ? 'focus.showSubjectTasks' : 'focus.showAllTasks')}</Text>
      </Pressable> : undefined}
      onSelect={chooseTask} onRetry={() => { void loadLinks(); }} onClose={() => setPicker(null)} />

    <ConfirmDialog testID="focus-confirm" visible={confirmOpen} busy={false} destructive={confirm.kind === 'reset'}
      title={t(confirm.kind === 'reset' ? 'focus.resetTitle' : 'focus.endTitle')}
      body={confirm.kind === 'end' ? (confirm.keptMinutes === null ? t('focus.endBodyShort') : confirm.keptMinutes === 1 ? t('focus.endBodyKeepOne') : t('focus.endBodyKeepMany', { count: confirm.keptMinutes })) : t('focus.resetBody')}
      confirmLabel={t(confirm.kind === 'reset' ? 'focus.resetConfirm' : 'focus.end')} cancelLabel={t('focus.keepGoing')}
      onCancel={() => setConfirmOpen(false)}
      onConfirm={() => { if (confirmOpen) dispatch({ type: confirm.kind }); setConfirmOpen(false); }} />
  </>;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.space3 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space4 },
  center: { alignItems: 'center' }, muted: { ...typography.body },
  timerCard: { alignItems: 'stretch' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3, borderWidth: 1, borderRadius: radius.radiusMd, paddingLeft: spacing.space4, paddingVertical: spacing.space1 },
  noticeText: { ...typography.body, flex: 1, lineHeight: 22, paddingVertical: spacing.space2 },
  dismiss: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 54, borderRadius: radius.radiusMd, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2, paddingHorizontal: spacing.space5 },
  primaryText: { ...typography.body, fontWeight: '700', color: colors.white },
  pressed: { opacity: 0.75 },
  secondaryRow: { flexDirection: 'row', gap: spacing.space2 },
  secondary: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: radius.radiusMd, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space1, paddingHorizontal: spacing.space2 },
  secondaryText: { ...typography.label, flexShrink: 1, textAlign: 'center' },
  note: { ...typography.label, fontWeight: '400', lineHeight: 18 },
  stats: { flexDirection: 'row', gap: spacing.space3 },
  stat: { flex: 1, borderWidth: 1, borderRadius: radius.radiusMd, padding: spacing.space4, gap: spacing.space1 },
  statLabel: { ...typography.label }, statValue: { ...typography.sectionTitle, fontVariant: ['tabular-nums'] }, statSmall: { ...typography.body, fontWeight: '600' },
  insights: { minHeight: 56, borderWidth: 1, borderRadius: radius.radiusMd, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3, flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  insightsCopy: { flex: 1, gap: 2 }, insightsTitle: { ...typography.body, fontWeight: '600' },
  sync: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingHorizontal: spacing.space1 },
  syncText: { ...typography.label, fontWeight: '400', lineHeight: 18, flex: 1 },
  scope: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, scopeText: { ...typography.body, fontWeight: '600' },
});
