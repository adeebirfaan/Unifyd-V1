import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { dayKey } from '@/components/timetable/ClassFields';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { SemesterChoice, StudentSemesterCourse } from '@/lib/semesterCourses';
import { creditSummary } from '@/lib/semesterCourses';
import type { AcademicFocus } from '@/lib/studiesOverview';
import { minutesUntilClass } from '@/lib/studiesOverview';
import { nextClass, shortTime, toMinutes } from '@/lib/timetable';
import type { TimetableEntry } from '@/lib/timetable';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];
export type Loadable<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; value: T };

/**
 * The Studies deck's cards: Academic focus on the brand gradient (the main card), Today and Semester on the dark card surface. Every figure comes from saved tasks, timetable
 * classes, and My semester subjects; empty states stay calm and offer the existing screen, never a requirement.
 */

function Eyebrow({ icon, children }: { icon: IconName; children: string }) {
  const { tokens } = useAppearance();
  return <View style={styles.eyebrowRow}>
    <Ionicons name={icon} size={18} color={tokens.brandCyan} />
    <Text style={[styles.eyebrow, { color: tokens.brandCyan }]}>{children}</Text>
  </View>;
}

function CardAction({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const { tokens } = useAppearance();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [styles.action, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, pressed && styles.pressed]}>
    <Text style={[styles.actionText, { color: tokens.cardText }]}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color={tokens.brandCyan} />
  </Pressable>;
}

function Status({ children }: { children: ReactNode }) {
  const { tokens } = useAppearance();
  return <View style={styles.status}><ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.body, { color: tokens.cardMutedText }]}>{children}</Text></View>;
}

/** Card 1: the next saved class by the device's local time, with "Starts in" only for a later class today. */
export function NextClassDeckCard({ classes, now, onOpenTimetable }: { classes: Loadable<TimetableEntry[] | null>; now: Date; onOpenTimetable: () => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  if (classes.state === 'loading') return <View style={styles.card}><Eyebrow icon="time-outline">{t('studies.nextClassEyebrow')}</Eyebrow><Status>{t('studies.classesLoading')}</Status></View>;
  // No semester chosen, no classes, or a failed load: a calm note and the timetable, never an error or a setup demand.
  const next = classes.state === 'ready' && classes.value ? nextClass(classes.value, now) : null;
  if (!next) return <View testID="planner-next-class" style={styles.card}>
    <Eyebrow icon="time-outline">{t('studies.nextClassEyebrow')}</Eyebrow>
    <Text style={[styles.headline, { color: tokens.cardText }]}>{t('timetable.noUpcoming')}</Text>
    <Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('studies.noClassBody')}</Text>
    <CardAction testID="studies-open-timetable" label={t('studies.viewTimetable')} onPress={onOpenTimetable} />
  </View>;
  const { entry, daysAhead } = next;
  const time = `${shortTime(entry.start_time)}–${shortTime(entry.end_time)}`;
  const day = t(dayKey(entry.day_of_week));
  const when = daysAhead === 0 ? t('timetable.nextToday', { time }) : daysAhead === 1 ? t('timetable.nextTomorrow', { time })
    : daysAhead === 7 ? t('timetable.nextWeek', { day, time }) : t('timetable.nextDay', { day, time });
  const name = entry.course_code ? `${entry.course_code} · ${entry.course_name}` : entry.course_name;
  const start = toMinutes(entry.start_time);
  const left = start === null ? null : minutesUntilClass(start, daysAhead, now);
  const startsIn = left === null ? null : left < 60 ? t('studies.startsInMinutes', { count: left })
    : left % 60 === 0 ? t('studies.startsInHoursExact', { hours: Math.floor(left / 60) }) : t('studies.startsInHours', { hours: Math.floor(left / 60), minutes: left % 60 });
  return <View testID="planner-next-class" accessible accessibilityLabel={[`${t('timetable.nextClass')}: ${name}`, when, entry.location, startsIn].filter(Boolean).join(', ')} style={styles.card}>
    <Eyebrow icon="time-outline">{t('studies.nextClassEyebrow')}</Eyebrow>
    <Text style={[styles.headline, { color: tokens.cardText }]} numberOfLines={3}>{name}</Text>
    <View style={styles.line}><Ionicons name="calendar-outline" size={16} color={tokens.cardMutedText} /><Text style={[styles.body, { color: tokens.cardMutedText }]}>{when}</Text></View>
    {entry.location ? <View style={styles.line}><Ionicons name="location-outline" size={16} color={tokens.cardMutedText} /><Text style={[styles.body, { color: tokens.cardMutedText }]} numberOfLines={1}>{entry.location}</Text></View> : null}
    {startsIn && <View style={[styles.pill, { backgroundColor: tokens.cardElevated }]}><Ionicons name="hourglass-outline" size={14} color={tokens.brandCyan} /><Text style={[styles.pillText, { color: tokens.cardText }]}>{startsIn}</Text></View>}
  </View>;
}

// On the brand gradient everything is white, as on Wallet's overview card (`FinanceOverviewCard` embedded palette).
const onBlue = { text: colors.white, muted: 'rgba(255,255,255,0.85)', tile: 'rgba(255,255,255,0.18)', track: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.4)' };

/**
 * The main Studies card, first in the deck on the Home/Wallet brand gradient: counts from saved tasks and
 * "N of M tasks completed" (the bar only repeats that sentence). Overdue and due-today are written out; a filled
 * icon marks a count above zero, so colour is never the only cue on the blue surface.
 */
export function FocusDeckCard({ focus }: { focus: Loadable<AcademicFocus> }) {
  const { t } = useI18n();
  const eyebrow = <View style={styles.eyebrowRow}>
    <Ionicons name="school-outline" size={18} color={onBlue.text} />
    <Text style={[styles.eyebrow, { color: onBlue.text }]}>{t('studies.focusEyebrow')}</Text>
  </View>;
  if (focus.state === 'loading') return <View style={styles.card}>{eyebrow}
    <View style={styles.status}><ActivityIndicator color={onBlue.text} /><Text style={[styles.body, { color: onBlue.muted }]}>{t('task.loading')}</Text></View>
  </View>;
  if (focus.state === 'error') return <View style={styles.card}>{eyebrow}<Text style={[styles.body, { color: onBlue.text }]} accessibilityRole="alert">{t('task.loadError')}</Text></View>;
  const { overdue, dueToday, upcoming, completed, total } = focus.value;
  if (!total) return <View testID="studies-focus" style={styles.card}>
    {eyebrow}
    {/* Calm text only: the Add task shortcut and the Priority tasks empty state sit just below. */}
    <Text style={[styles.headline, { color: onBlue.text }]}>{t('studies.focusEmpty')}</Text>
    <Text style={[styles.body, { color: onBlue.muted }]}>{t('studies.noTasksYet')}</Text>
  </View>;
  const stats: { key: string; icon: IconName; filled: IconName; label: string; value: number }[] = [
    { key: 'overdue', icon: 'alert-circle-outline', filled: 'alert-circle', label: t('task.overdue'), value: overdue },
    { key: 'today', icon: 'today-outline', filled: 'today', label: t('studies.dueToday'), value: dueToday },
    { key: 'upcoming', icon: 'calendar-outline', filled: 'calendar', label: t('studies.upcoming'), value: upcoming },
  ];
  const progress = total === 1 ? t('studies.progressOne', { completed }) : t('studies.progress', { completed, total });
  return <View testID="studies-focus" style={styles.card}>
    {eyebrow}
    <View style={styles.stats}>
      {stats.map((stat) => <View key={stat.key} testID={`studies-focus-${stat.key}`} accessible accessibilityLabel={`${stat.label}: ${stat.value}`} style={[styles.stat, { backgroundColor: onBlue.tile }]}>
        <Ionicons name={stat.value ? stat.filled : stat.icon} size={18} color={onBlue.text} />
        <Text style={[styles.statValue, { color: onBlue.text }]}>{stat.value}</Text>
        <Text style={[styles.statLabel, { color: onBlue.muted }]} numberOfLines={2}>{stat.label}</Text>
      </View>)}
    </View>
    <View style={[styles.progress, { borderTopColor: onBlue.track }]}>
      <Text testID="studies-progress" style={[styles.body, { color: onBlue.text }]}>{progress}</Text>
      <View style={[styles.track, { backgroundColor: onBlue.track }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.bar, { width: `${(completed / total) * 100}%`, backgroundColor: onBlue.text }]} />
      </View>
    </View>
  </View>;
}

/** Card 3: the subjects saved in My semester for the last chosen semester. Credits only when every one is known. */
export function SemesterDeckCard({ semester, onOpenSemester }: { semester: Loadable<{ choice: SemesterChoice; courses: StudentSemesterCourse[] } | null>; onOpenSemester: () => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  if (semester.state === 'loading') return <View style={styles.card}><Eyebrow icon="book-outline">{t('studies.semesterEyebrow')}</Eyebrow><Status>{t('studies.semesterLoading')}</Status></View>;
  if (semester.state === 'error') return <View testID="studies-semester" style={styles.card}>
    <Eyebrow icon="book-outline">{t('studies.semesterEyebrow')}</Eyebrow>
    <Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('studies.semesterError')}</Text>
    <CardAction testID="studies-open-semester" label={t('studies.viewSubjects')} onPress={onOpenSemester} />
  </View>;
  const courses = semester.value?.courses ?? [];
  if (!semester.value || !courses.length) return <View testID="studies-semester" style={styles.card}>
    <Eyebrow icon="book-outline">{t('studies.semesterEyebrow')}</Eyebrow>
    <Text style={[styles.headline, { color: tokens.cardText }]}>{t('studies.noSubjects')}</Text>
    <Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('studies.noSubjectsBody')}</Text>
    <CardAction testID="studies-open-semester" label={t('studies.chooseSubjects')} onPress={onOpenSemester} />
  </View>;
  const { choice } = semester.value;
  const credits = creditSummary(courses);
  return <View testID="studies-semester" style={styles.card}>
    <Eyebrow icon="book-outline">{t('studies.semesterEyebrow')}</Eyebrow>
    <Text style={[styles.headline, { color: tokens.cardText }]}>{courses.length === 1 ? t('studies.subjectsOne') : t('studies.subjectsMany', { count: courses.length })}</Text>
    <Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('studies.semesterLabel', { session: choice.academicSession, semester: choice.semester })}</Text>
    <Text testID="studies-credits" style={[styles.body, { color: tokens.cardMutedText }]}>{credits.unknownCount ? t('semester.creditsUnknown') : t('semester.credits', { count: credits.knownTotal })}</Text>
    <CardAction testID="studies-open-semester" label={t('studies.viewSubjects')} onPress={onOpenSemester} />
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: spacing.space4, gap: spacing.space2 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, marginBottom: spacing.space1 },
  eyebrow: { ...typography.label, fontWeight: '700', letterSpacing: 1.5 },
  headline: { ...typography.sectionTitle, lineHeight: 25 },
  body: { ...typography.body, lineHeight: 22, flexShrink: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  status: { minHeight: 96, justifyContent: 'center', alignItems: 'flex-start', gap: spacing.space2 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.space1, borderRadius: radius.radiusFull, paddingHorizontal: spacing.space3, paddingVertical: spacing.space1, marginTop: spacing.space1 },
  pillText: { ...typography.label, fontWeight: '600' },
  action: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space1, borderWidth: 1, borderRadius: radius.radiusMd, paddingHorizontal: spacing.space3, marginTop: spacing.space2 },
  actionText: { ...typography.label, fontWeight: '600' }, pressed: { opacity: 0.75 },
  stats: { flexDirection: 'row', gap: spacing.space2 },
  stat: { flex: 1, borderRadius: radius.radiusMd, padding: spacing.space3, gap: 2 },
  statValue: { ...typography.sectionTitle }, statLabel: { ...typography.label, fontSize: 12 },
  progress: { gap: spacing.space2, marginTop: spacing.space2, paddingTop: spacing.space3, borderTopWidth: 1 },
  track: { height: 6, borderRadius: radius.radiusFull, overflow: 'hidden' }, bar: { height: 6, borderRadius: radius.radiusFull },
});
