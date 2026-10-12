import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SelectionField } from '@/components/profile/SelectionField';
import { ExpenseTextField } from '@/components/wallet/ExpenseTextField';
import type { TranslationKey } from '@/constants/i18n';
import { radius, spacing, typography } from '@/constants/theme';
import { taskSubject } from '@/lib/semesterCourses';
import { WEEK_DAYS } from '@/lib/timetable';
import type { ClassDraft, DraftError, SemesterSubject } from '@/lib/timetable';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const NOT_LINKED = 'none';
export const dayKey = (day: number) => `timetable.day${day}` as TranslationKey;
export const dayShortKey = (day: number) => `timetable.dayShort${day}` as TranslationKey;

/**
 * Editable class details shared by the manual form and the import review.
 * Linking a My Semester subject is always the student's choice; a matching
 * course code is only offered as a suggestion.
 */
export function ClassFields({ draft, onChange, subjects, errors, clashNames }: {
  draft: ClassDraft;
  onChange: (draft: ClassDraft) => void;
  subjects: readonly SemesterSubject[];
  errors: readonly DraftError[];
  clashNames: readonly string[];
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const suggested = draft.subjectId ? null : subjects.find((subject) => subject.id === draft.suggestedSubjectId);
  const update = (changes: Partial<ClassDraft>) => onChange({ ...draft, ...changes });
  const link = (subject: SemesterSubject) => update({
    subjectId: subject.id, suggestedSubjectId: null,
    courseCode: subject.course_code ?? draft.courseCode, courseName: subject.course_name,
  });

  return <View style={styles.fields}>
    {subjects.length > 0 && <SelectionField label={t('timetable.subject')} value={draft.subjectId ?? NOT_LINKED} placeholder={t('timetable.subjectNone')} labelOnCard
      options={[{ id: NOT_LINKED, label: t('timetable.subjectNone') }, ...subjects.map((subject) => ({ id: subject.id, label: taskSubject(subject) }))]}
      onSelect={(id) => { const subject = subjects.find((item) => item.id === id); if (subject) link(subject); else update({ subjectId: null }); }} />}
    {suggested && <View style={[styles.suggestion, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
      <Ionicons name="link-outline" size={18} color={tokens.brandCyan} />
      <Text style={[styles.suggestionText, { color: tokens.cardText }]}>{t('timetable.suggested', { name: taskSubject(suggested) })}</Text>
      <View style={styles.suggestionActions}>
        <Pressable accessibilityRole="button" onPress={() => link(suggested)} style={styles.suggestionButton}><Text style={[styles.suggestionAction, { color: tokens.brandCyan }]}>{t('timetable.linkSuggested')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => update({ suggestedSubjectId: null })} style={styles.suggestionButton}><Text style={[styles.suggestionAction, { color: tokens.cardMutedText }]}>{t('timetable.dismissSuggested')}</Text></Pressable>
      </View>
    </View>}
    <ExpenseTextField label={t('timetable.courseCode')} value={draft.courseCode} onChangeText={(courseCode) => update({ courseCode })} placeholder={t('timetable.courseCodePlaceholder')} autoCapitalize="characters" maxLength={40} />
    <ExpenseTextField label={t('timetable.courseName')} value={draft.courseName} onChangeText={(courseName) => update({ courseName })} placeholder={t('timetable.courseNamePlaceholder')} error={errors.includes('courseName') ? t('timetable.nameRequired') : undefined} maxLength={200} />
    <SelectionField label={t('timetable.day')} value={draft.day ? String(draft.day) : null} placeholder={t('timetable.dayPlaceholder')} labelOnCard
      options={WEEK_DAYS.map((day) => ({ id: String(day), label: t(dayKey(day)) }))} onSelect={(id) => update({ day: Number(id) })}
      error={errors.includes('day') ? t('timetable.dayRequired') : undefined} />
    <View style={styles.times}>
      <View style={styles.time}><ExpenseTextField label={t('timetable.start')} value={draft.start ?? ''} onChangeText={(start) => update({ start })} placeholder={t('timetable.startPlaceholder')} keyboardType="numbers-and-punctuation" maxLength={5} error={errors.includes('start') ? t('timetable.startInvalid') : undefined} /></View>
      <View style={styles.time}><ExpenseTextField label={t('timetable.end')} value={draft.end ?? ''} onChangeText={(end) => update({ end })} placeholder={t('timetable.endPlaceholder')} keyboardType="numbers-and-punctuation" maxLength={5} error={errors.includes('end') ? t('timetable.endInvalid') : errors.includes('order') ? t('timetable.orderInvalid') : undefined} /></View>
    </View>
    <ExpenseTextField label={t('timetable.location')} value={draft.location} onChangeText={(location) => update({ location })} placeholder={t('timetable.locationPlaceholder')} maxLength={120} />
    <ExpenseTextField label={t('timetable.section')} value={draft.section} onChangeText={(section) => update({ section })} placeholder={t('timetable.sectionPlaceholder')} maxLength={40} />
    {clashNames.length > 0 && <View style={styles.clash} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={19} color={tokens.cardErrorText} />
      <Text style={[styles.clashText, { color: tokens.cardErrorText }]}>{t('timetable.clashWarning', { names: clashNames.join(', ') })}</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  fields: { gap: spacing.space4 },
  suggestion: { borderWidth: 1, borderRadius: radius.radiusMd, padding: spacing.space3, gap: spacing.space2 },
  suggestionText: { ...typography.body, lineHeight: 22 }, suggestionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2 },
  suggestionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.space2 }, suggestionAction: { ...typography.label },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space3 }, time: { flexGrow: 1, flexBasis: 130 },
  clash: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2 }, clashText: { ...typography.label, flex: 1, lineHeight: 20 },
});
