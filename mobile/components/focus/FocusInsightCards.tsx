import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { radius, spacing, typography } from '@/constants/theme';
import { GOAL_LIMITS, focusDuration, goalProgress } from '@/lib/focusInsights';
import type { FocusGoal, FocusRecord, FocusSummary, SubjectShare } from '@/lib/focusInsights';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const CHART_HEIGHT = 120;
const MIN_SCALE = 30 * 60; // a short day never fills the chart
const TOP_SUBJECTS = 5;

/** "1 h 25 min" or "25 min" from recorded seconds (rounded down). */
export function useDurationText() {
  const { t } = useI18n();
  return (seconds: number) => {
    const { hours, minutes } = focusDuration(seconds);
    return hours ? t('focus.durationHM', { hours, minutes }) : t('focus.durationM', { minutes });
  };
}

function Card({ testID, title, aside, children }: { testID: string; title: string; aside?: string; children: ReactNode }) {
  const { tokens } = useAppearance();
  return <View testID={testID} style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <View style={styles.cardHeader}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: tokens.cardText }]}>{title}</Text>
      {aside && <Text style={[styles.aside, { color: tokens.cardMutedText }]}>{aside}</Text>}
    </View>
    {children}
  </View>;
}

/**
 * Monday–Sunday bars of recorded focus time (by the local day each round ended). Today is cyan and its label bold;
 * other days are Unifyd blue; days still to come show only a faint track. Each day is announced with its time.
 */
export function FocusWeekChart({ summary, language }: { summary: FocusSummary; language: 'en' | 'ms' }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const duration = useDurationText();
  const [width, setWidth] = useState(0);
  const scale = Math.max(MIN_SCALE, ...summary.week.map((day) => day.seconds));
  const column = width / 7;
  const bar = Math.min(28, column * 0.55);
  const weekday = new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', { weekday: 'short' });
  const longDay = new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', { weekday: 'long' });
  return <Card testID="focus-week" title={t('focus.weekTitle')} aside={duration(summary.weekSeconds)}>
    {summary.weekSeconds === 0 && <Text style={[styles.empty, { color: tokens.cardMutedText }]}>{t('focus.weekEmpty')}</Text>}
    <View onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))} style={{ height: CHART_HEIGHT }} importantForAccessibility="no-hide-descendants">
      {width > 0 && <Svg width={width} height={CHART_HEIGHT}>
        {summary.week.map((day, index) => {
          const height = day.seconds ? Math.max(4, (day.seconds / scale) * (CHART_HEIGHT - 4)) : 0;
          const x = index * column + (column - bar) / 2;
          return [
            <Rect key={`${day.key}-track`} x={x} y={0} width={bar} height={CHART_HEIGHT} rx={6} fill={tokens.cardElevated} opacity={day.isFuture ? 0.4 : 1} />,
            height > 0 && <Rect key={day.key} x={x} y={CHART_HEIGHT - height} width={bar} height={height} rx={6} fill={day.isToday ? tokens.brandCyan : tokens.brandBlue} />,
          ];
        })}
      </Svg>}
    </View>
    <View style={styles.days}>
      {summary.week.map((day) => <View key={day.key} testID={`focus-day-${day.key}`} accessible accessibilityLabel={t('focus.dayA11y', { day: longDay.format(day.date), duration: duration(day.seconds) })} style={styles.day}>
        <Text style={[styles.dayLabel, { color: day.isToday ? tokens.cardText : tokens.cardMutedText }, day.isToday && styles.today]}>{weekday.format(day.date)}</Text>
      </View>)}
    </View>
  </Card>;
}

/** Recorded time per saved subject label over the last 30 days, with whole percentages that add up to 100. */
export function FocusSubjects({ summary }: { summary: FocusSummary }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const duration = useDurationText();
  const shown: (SubjectShare & { other?: boolean })[] = summary.subjects.slice(0, TOP_SUBJECTS);
  const rest = summary.subjects.slice(TOP_SUBJECTS);
  if (rest.length) shown.push({ label: null, other: true, seconds: rest.reduce((sum, item) => sum + item.seconds, 0), percent: rest.reduce((sum, item) => sum + item.percent, 0) });
  return <Card testID="focus-subjects" title={t('focus.subjectsTitle')}>
    {shown.length === 0 ? <Text style={[styles.empty, { color: tokens.cardMutedText }]}>{t('focus.subjectsEmpty')}</Text>
      : shown.map((item, index) => {
        const name = item.other ? t('focus.otherSubjects') : item.label ?? t('focus.generalStudy');
        return <View key={`${index}-${name}`} testID="focus-subject-row" accessible accessibilityLabel={t('focus.subjectA11y', { subject: name, duration: duration(item.seconds), percent: item.percent })} style={styles.subject}>
          <View style={styles.subjectTop}>
            <Text style={[styles.subjectName, { color: tokens.cardText }]} numberOfLines={2}>{name}</Text>
            <Text style={[styles.subjectValue, { color: tokens.cardMutedText }]}>{duration(item.seconds)} · {item.percent}%</Text>
          </View>
          <View style={[styles.track, { backgroundColor: tokens.cardElevated }]}>
            <View style={[styles.fill, { width: `${item.percent}%`, backgroundColor: index === 0 ? tokens.brandCyan : tokens.brandBlue }]} />
          </View>
        </View>;
      })}
  </Card>;
}

/**
 * An optional daily or weekly focus goal. Progress is shown calmly and resets each day or week; there are no streaks.
 * The editor (Off, Daily, Weekly, and a stepper) opens only when asked.
 */
export function FocusGoalCard({ goal, summary, saveFailed, onChange }: {
  goal: FocusGoal | null; summary: FocusSummary; saveFailed: boolean; onChange: (goal: FocusGoal | null) => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const duration = useDurationText();
  const [editing, setEditing] = useState(false);
  const progress = goal ? goalProgress(goal, summary) : null;
  const choose = (period: 'day' | 'week' | null) => onChange(period ? { period, minutes: goal?.period === period ? goal.minutes : GOAL_LIMITS[period].initial } : null);
  const step = (direction: 1 | -1) => {
    if (!goal) return;
    const limits = GOAL_LIMITS[goal.period];
    onChange({ ...goal, minutes: Math.min(limits.max, Math.max(limits.min, goal.minutes + direction * limits.step)) });
  };
  const option = (key: 'off' | 'day' | 'week', label: string) => {
    const selected = key === 'off' ? !goal : goal?.period === key;
    return <Pressable key={key} testID={`focus-goal-${key}`} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected}
      onPress={() => choose(key === 'off' ? null : key)} style={({ pressed }) => [styles.chip, { backgroundColor: tokens.cardElevated, borderColor: selected ? tokens.brandCyan : tokens.border }, pressed && styles.pressed]}>
      <Text style={[styles.chipText, { color: tokens.cardText }]}>{label}</Text>
    </Pressable>;
  };
  return <Card testID="focus-goal" title={t('focus.goalTitle')}>
    {progress && goal ? <View accessible testID="focus-goal-progress" accessibilityLabel={`${t(goal.period === 'day' ? 'focus.goalProgressDay' : 'focus.goalProgressWeek', { done: duration(progress.doneMinutes * 60), goal: duration(goal.minutes * 60) })}${progress.reached ? `. ${t('focus.goalReached')}` : ''}`} style={styles.goalBody}>
      <Text style={[styles.goalText, { color: tokens.cardText }]}>{t(goal.period === 'day' ? 'focus.goalProgressDay' : 'focus.goalProgressWeek', { done: duration(progress.doneMinutes * 60), goal: duration(goal.minutes * 60) })}</Text>
      <View style={[styles.track, styles.goalTrack, { backgroundColor: tokens.cardElevated }]}>
        <View style={[styles.fill, { width: `${Math.round(progress.ratio * 100)}%`, backgroundColor: tokens.brandCyan }]} />
      </View>
      {progress.reached && <View style={styles.reached}><Ionicons name="checkmark-circle" size={16} color={tokens.successText} /><Text style={[styles.note, { color: tokens.cardText }]}>{t('focus.goalReached')}</Text></View>}
    </View> : <Text style={[styles.empty, { color: tokens.cardMutedText }]}>{t('focus.goalNone')}</Text>}
    {editing ? <View testID="focus-goal-editor" style={styles.editor}>
      <View style={styles.chips} accessibilityRole="radiogroup">{[option('off', t('focus.goalOff')), option('day', t('focus.goalDaily')), option('week', t('focus.goalWeekly'))]}</View>
      {goal && <View style={[styles.stepper, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
        <Text style={[styles.stepLabel, { color: tokens.cardText }]}>{t('focus.goalLength')}</Text>
        <View style={styles.stepControls}>{([-1, 1] as const).map((direction) => {
          const limits = GOAL_LIMITS[goal.period];
          const disabled = direction < 0 ? goal.minutes <= limits.min : goal.minutes >= limits.max;
          const button = <Pressable key={direction} testID={`focus-goal-${direction > 0 ? 'more' : 'less'}`} accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
            accessibilityLabel={t(direction > 0 ? 'focus.increase' : 'focus.decrease', { name: t('focus.goalLength') })} onPress={() => step(direction)}
            style={({ pressed }) => [styles.stepButton, { borderColor: tokens.border, backgroundColor: tokens.cardBackground }, (pressed || disabled) && styles.dimmed]}>
            <Ionicons name={direction > 0 ? 'add' : 'remove'} size={20} color={tokens.cardText} />
          </Pressable>;
          return direction < 0 ? [button, <Text key="value" testID="focus-goal-value" style={[styles.stepValue, { color: tokens.cardText }]}>{duration(goal.minutes * 60)}</Text>] : button;
        })}</View>
      </View>}
      <Text style={[styles.note, { color: tokens.cardMutedText }]}>{t('focus.goalNote')}</Text>
      <Pressable testID="focus-goal-done" accessibilityRole="button" onPress={() => setEditing(false)} style={styles.link}><Text style={[styles.linkText, { color: tokens.brandCyan }]}>{t('focus.goalDone')}</Text></Pressable>
    </View> : <Pressable testID="focus-goal-edit" accessibilityRole="button" onPress={() => setEditing(true)} style={styles.link}>
      <Text style={[styles.linkText, { color: tokens.brandCyan }]}>{t(goal ? 'focus.goalChange' : 'focus.goalSet')}</Text>
    </Pressable>}
    {saveFailed && <Text accessibilityRole="alert" style={[styles.note, { color: tokens.cardErrorText }]}>{t('focus.goalSaveError')}</Text>}
  </Card>;
}

/** One history row: subject (or General study), task, end date and time, recorded time, and Completed or Partial in words. */
export function FocusHistoryRow({ record, language, first, last }: { record: FocusRecord; language: 'en' | 'ms'; first: boolean; last: boolean }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const duration = useDurationText();
  const subject = record.subjectLabel ?? t('focus.generalStudy');
  const when = new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(record.endedAt));
  const status = t(record.status === 'completed' ? 'focus.statusCompleted' : 'focus.statusPartial');
  const parts = [subject, record.taskTitle, when, duration(record.focusSeconds), status, record.source === 'device' ? t('focus.onDevice') : null].filter(Boolean);
  return <View testID="focus-history-row" accessible accessibilityLabel={parts.join(', ')}
    style={[styles.row, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }, first && styles.rowFirst, last && styles.rowLast, !first && styles.rowJoined]}>
    <Ionicons name={record.status === 'completed' ? 'checkmark-circle' : 'pie-chart-outline'} size={22} color={record.status === 'completed' ? tokens.brandCyan : tokens.cardMutedText} />
    <View style={styles.rowCopy}>
      <Text style={[styles.rowTitle, { color: tokens.cardText }]} numberOfLines={2}>{subject}</Text>
      {record.taskTitle && <Text style={[styles.rowMeta, { color: tokens.cardMutedText }]} numberOfLines={1}>{record.taskTitle}</Text>}
      <Text style={[styles.rowMeta, { color: tokens.cardMutedText }]}>{when}</Text>
      {record.source === 'device' && <View style={styles.device}><Ionicons name="cloud-offline-outline" size={13} color={tokens.cardMutedText} /><Text style={[styles.rowMeta, { color: tokens.cardMutedText }]}>{t('focus.onDevice')}</Text></View>}
    </View>
    <View style={styles.rowEnd}>
      <Text style={[styles.rowDuration, { color: tokens.cardText }]}>{duration(record.focusSeconds)}</Text>
      <Text style={[styles.rowMeta, { color: tokens.cardMutedText }]}>{status}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space3 },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.space2 },
  cardTitle: { ...typography.sectionTitle, flexShrink: 1 }, aside: { ...typography.body, fontWeight: '600' },
  empty: { ...typography.body, lineHeight: 22 },
  days: { flexDirection: 'row' }, day: { flex: 1, alignItems: 'center', minHeight: 24, justifyContent: 'center' },
  dayLabel: { ...typography.label, fontWeight: '500' }, today: { fontWeight: '700' },
  subject: { gap: spacing.space1 + 2 }, subjectTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.space3 },
  subjectName: { ...typography.body, fontWeight: '600', flex: 1 }, subjectValue: { ...typography.label, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: radius.radiusFull, overflow: 'hidden' }, goalTrack: { height: 8 }, fill: { height: '100%', borderRadius: radius.radiusFull },
  goalBody: { gap: spacing.space2 }, goalText: { ...typography.body, fontWeight: '600' },
  reached: { flexDirection: 'row', alignItems: 'center', gap: spacing.space1 },
  note: { ...typography.label, fontWeight: '400', lineHeight: 18 },
  editor: { gap: spacing.space3 }, chips: { flexDirection: 'row', gap: spacing.space2 },
  chip: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.space2 },
  chipText: { ...typography.label, fontSize: 14 }, pressed: { opacity: 0.75 }, dimmed: { opacity: 0.6 },
  // Label and controls share one row; on a narrow phone or with a long label the controls wrap below, right-aligned.
  stepper: { minHeight: 56, borderWidth: 1, borderRadius: radius.radiusMd, paddingLeft: spacing.space4, paddingRight: spacing.space2, paddingVertical: spacing.space1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.space2 },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, marginLeft: 'auto' },
  stepLabel: { ...typography.label, fontSize: 15, flexGrow: 1, flexShrink: 1, minHeight: 44, textAlignVertical: 'center', paddingVertical: 12 },
  stepButton: { width: 44, height: 44, borderRadius: radius.radiusFull, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue: { ...typography.body, fontWeight: '700', minWidth: 76, textAlign: 'center', fontVariant: ['tabular-nums'] },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, linkText: { ...typography.body, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space3, padding: spacing.space4, borderWidth: 1, borderLeftWidth: 1, borderRightWidth: 1 },
  rowFirst: { borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg },
  rowLast: { borderBottomLeftRadius: radius.radiusLg, borderBottomRightRadius: radius.radiusLg },
  rowJoined: { borderTopWidth: 0 },
  rowCopy: { flex: 1, gap: 2 }, rowTitle: { ...typography.body, fontWeight: '600' }, rowMeta: { ...typography.label, fontWeight: '400' },
  device: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rowEnd: { alignItems: 'flex-end', gap: 2 }, rowDuration: { ...typography.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
