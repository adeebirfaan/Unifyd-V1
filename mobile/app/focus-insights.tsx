import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { FocusSuggestionsCard } from '@/components/focus/FocusCompanion';
import { FocusGoalCard, FocusHistoryRow, FocusSubjects, FocusWeekChart, useDurationText } from '@/components/focus/FocusInsightCards';
import { TaskPageHeader } from '@/components/planner/TaskPage';
import { radius, spacing, typography } from '@/constants/theme';
import { loadFocusHistoryPage, loadFocusRecords, readFocusGoal, writeFocusGoal } from '@/lib/focusHistory';
import { focusSuggestions, insightsFetchSince, mergeFocusRecords, recordFromBlock, summarizeFocus } from '@/lib/focusInsights';
import type { FocusGoal, FocusRecord, SuggestionTask } from '@/lib/focusInsights';
import { loadFocusBlocks } from '@/lib/focusStorage';
import { onFocusSyncChange, syncFocusRounds } from '@/lib/focusSync';
import { loadStudentCourses, readSemesterChoice, taskSubject } from '@/lib/semesterCourses';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type Remote = { state: 'loading' } | { state: 'error' } | { state: 'ready'; records: FocusRecord[] };
type History = { state: 'loading' | 'ready' | 'error' | 'loadingMore' | 'moreError'; records: FocusRecord[]; more: boolean };

/**
 * Focus insights (Phase 4), opened from Unifyd Focus: today, this week, rounds this week, an optional goal, the
 * Monday–Sunday chart, subjects over the last 30 days, and paged history. Figures come from synced `focus_sessions`
 * rows plus rounds still waiting on this device, merged by round ID (rules in `lib/focusInsights.ts`). If the synced
 * history cannot load, the device rounds still show, with a retry.
 */
export default function FocusInsightsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const duration = useDurationText();
  const [now, setNow] = useState(() => new Date());
  const [remote, setRemote] = useState<Remote>({ state: 'loading' });
  const [device, setDevice] = useState<FocusRecord[]>([]);
  const [history, setHistory] = useState<History>({ state: 'loading', records: [], more: false });
  const [goal, setGoal] = useState<FocusGoal | null>(null);
  const [goalSaveFailed, setGoalSaveFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Open tasks and semester subjects for Poof's suggestions (null when unavailable; those rules are then skipped).
  const [tasks, setTasks] = useState<SuggestionTask[] | null>(null);
  const [subjects, setSubjects] = useState<string[] | null>(null);
  const request = useRef(0);

  const load = useCallback(async (quiet = false) => {
    if (!userId) return;
    const version = ++request.current;
    const time = new Date();
    if (!quiet) { setRemote({ state: 'loading' }); setHistory({ state: 'loading', records: [], more: false }); }
    const [rows, page, blocks, savedGoal, openTasks, courses] = await Promise.allSettled([
      loadFocusRecords(userId, insightsFetchSince(time)), loadFocusHistoryPage(userId, 0), loadFocusBlocks(userId), readFocusGoal(userId),
      supabase.from('tasks').select('id,title,subject,deadline,status').eq('user_id', userId).neq('status', 'completed')
        .order('deadline', { ascending: true }).limit(200).then(({ data, error }) => { if (error) throw error; return (data ?? []) as SuggestionTask[]; }),
      readSemesterChoice(userId).then((choice) => choice ? loadStudentCourses(userId, choice) : []),
    ]);
    if (version !== request.current) return;
    setNow(time);
    setDevice(blocks.status === 'fulfilled' ? blocks.value.map(recordFromBlock) : []);
    setRemote(rows.status === 'fulfilled' ? { state: 'ready', records: rows.value } : { state: 'error' });
    setHistory(page.status === 'fulfilled' ? { state: 'ready', ...page.value } : { state: 'error', records: [], more: false });
    if (savedGoal.status === 'fulfilled') setGoal(savedGoal.value);
    setTasks(openTasks.status === 'fulfilled' ? openTasks.value : null);
    setSubjects(courses.status === 'fulfilled' ? courses.value.map(taskSubject) : null);
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void load();
    if (!userId) return;
    // Waiting rounds are sent first where possible; when a sync finishes the figures reload quietly (merged by ID, never double-counted).
    void syncFocusRounds(userId);
    const unsubscribe = onFocusSyncChange(userId, () => { void load(true); });
    return () => { ++request.current; unsubscribe(); };
  }, [load, userId]));

  async function loadMore() {
    if (!userId || history.state !== 'ready' || !history.more) return;
    const version = request.current;
    setHistory({ ...history, state: 'loadingMore' });
    try {
      const page = await loadFocusHistoryPage(userId, history.records.length);
      if (version !== request.current) return;
      const known = new Set(history.records.map((record) => record.id));
      setHistory({ state: 'ready', records: [...history.records, ...page.records.filter((record) => !known.has(record.id))], more: page.more });
    } catch { if (version === request.current) setHistory({ ...history, state: 'moreError' }); }
  }

  function changeGoal(next: FocusGoal | null) {
    if (!userId) return;
    setGoal(next);
    setGoalSaveFailed(false);
    writeFocusGoal(userId, next).catch(() => setGoalSaveFailed(true));
  }

  const loading = remote.state === 'loading';
  const records = mergeFocusRecords(remote.state === 'ready' ? remote.records : [], device);
  const summary = summarizeFocus(records, now);
  const historyRecords = mergeFocusRecords(history.records, device);
  const suggestions = focusSuggestions({ now, records: remote.state === 'ready' ? records : null, tasks, subjects, goal, limit: 3 });
  const card = [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];
  const tile = (testID: string, label: string, value: string, detail?: string) => <View testID={testID} accessible accessibilityLabel={[label, value, detail].filter(Boolean).join(', ')}
    style={[styles.tile, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <Text style={[styles.tileLabel, { color: tokens.cardMutedText }]}>{label}</Text>
    <Text style={[styles.tileValue, { color: tokens.cardText }]}>{value}</Text>
    {detail && <Text style={[styles.tileDetail, { color: tokens.cardMutedText }]}>{detail}</Text>}
  </View>;

  return <Screen compact refreshControl={<RefreshControl refreshing={refreshing} tintColor={tokens.brandCyan} colors={[tokens.brandBlue]}
    onRefresh={() => { setRefreshing(true); if (userId) void syncFocusRounds(userId); void load(true).finally(() => setRefreshing(false)); }} />}>
    <TaskPageHeader titleKey="focus.insightsTitle" helperKey="focus.insightsHelper" />
    <View style={styles.stack}>
      {loading ? <View style={[card, styles.center]}><ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('focus.insightsLoading')}</Text></View> : <>
        {remote.state === 'error' && <View testID="focus-insights-error" style={card}>
          <Text accessibilityRole="alert" style={[styles.muted, { color: tokens.cardText }]}>{t(device.length ? 'focus.insightsErrorDevice' : 'focus.insightsError')}</Text>
          <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.retry}><Text style={[styles.retryText, { color: tokens.brandCyan }]}>{t('focus.retry')}</Text></Pressable>
        </View>}
        {summary.deviceCount > 0 && <View testID="focus-insights-device" style={styles.deviceNote}>
          <Ionicons name="cloud-offline-outline" size={16} color={tokens.mutedText} />
          <Text style={[styles.deviceText, { color: tokens.mutedText }]}>{summary.deviceCount === 1 ? t('focus.deviceNoteOne') : t('focus.deviceNoteMany', { count: summary.deviceCount })}</Text>
        </View>}
        <View style={styles.tiles}>
          {tile('focus-today', t('focus.today'), duration(summary.todaySeconds))}
          {tile('focus-this-week', t('focus.thisWeek'), duration(summary.weekSeconds))}
        </View>
        {tile('focus-rounds', t('focus.roundsThisWeek'), String(summary.weekCompleted + summary.weekPartial), t('focus.roundsDetail', { completed: summary.weekCompleted, partial: summary.weekPartial }))}
        <FocusSuggestionsCard suggestions={suggestions} />
        <FocusGoalCard goal={goal} summary={summary} saveFailed={goalSaveFailed} onChange={changeGoal} />
        <FocusWeekChart summary={summary} language={language} />
        <FocusSubjects summary={summary} />
      </>}

      <Text accessibilityRole="header" style={[styles.section, { color: tokens.screenText }]}>{t('focus.historyTitle')}</Text>
      {history.state === 'loading' ? <View style={[card, styles.center]}><ActivityIndicator color={tokens.brandCyan} /></View>
        : historyRecords.length === 0 ? <View testID="focus-history-empty" style={card}>
          <Ionicons name="timer-outline" size={26} color={tokens.brandCyan} />
          <Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t(history.state === 'error' ? 'focus.historyError' : 'focus.historyEmpty')}</Text>
          {history.state === 'error' && <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.retry}><Text style={[styles.retryText, { color: tokens.brandCyan }]}>{t('focus.retry')}</Text></Pressable>}
        </View>
          : <View testID="focus-history">{historyRecords.map((record, index) => <FocusHistoryRow key={record.id} record={record} language={language} first={index === 0} last={index === historyRecords.length - 1} />)}</View>}
      {(history.more || history.state === 'loadingMore' || history.state === 'moreError') && <View style={styles.more}>
        {history.state === 'moreError' && <Text accessibilityRole="alert" style={[styles.muted, { color: tokens.errorText }]}>{t('focus.historyMoreError')}</Text>}
        <Pressable testID="focus-history-more" accessibilityRole="button" disabled={history.state === 'loadingMore'} accessibilityState={{ busy: history.state === 'loadingMore' }}
          onPress={() => { if (history.state === 'moreError') setHistory({ ...history, state: 'ready' }); void loadMore(); }}
          style={({ pressed }) => [styles.moreButton, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }, pressed && styles.pressed]}>
          {history.state === 'loadingMore' ? <ActivityIndicator color={tokens.brandCyan} /> : <Text style={[styles.retryText, { color: tokens.cardText }]}>{t('focus.loadMore')}</Text>}
        </Pressable>
      </View>}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.space3 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space3 },
  center: { alignItems: 'center' }, muted: { ...typography.body, lineHeight: 22 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, retryText: { ...typography.body, fontWeight: '600' },
  deviceNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingHorizontal: spacing.space1 },
  deviceText: { ...typography.label, fontWeight: '400', lineHeight: 18, flex: 1 },
  tiles: { flexDirection: 'row', gap: spacing.space3 },
  tile: { flex: 1, borderWidth: 1, borderRadius: radius.radiusMd, padding: spacing.space4, gap: spacing.space1 },
  tileLabel: { ...typography.label }, tileValue: { ...typography.sectionTitle, fontVariant: ['tabular-nums'] }, tileDetail: { ...typography.label, fontWeight: '400' },
  section: { ...typography.sectionTitle, marginTop: spacing.space3 },
  more: { gap: spacing.space2 },
  moreButton: { minHeight: 48, borderWidth: 1, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});
