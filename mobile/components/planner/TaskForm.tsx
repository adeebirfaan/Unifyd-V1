import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { SelectionField } from '@/components/profile/SelectionField';
import { ExpenseDatePicker } from '@/components/wallet/ExpenseDatePicker';
import { ExpenseTextField } from '@/components/wallet/ExpenseTextField';
import { radius, spacing, typography } from '@/constants/theme';
import { isReminderOffset } from '@/lib/reminderMath';
import { loadStudentCourses, readSemesterChoice, taskSubject } from '@/lib/semesterCourses';
import type { StudentSemesterCourse } from '@/lib/semesterCourses';
import type { ReminderOffset } from '@/lib/reminderMath';
import { deadlineIso, localDeadlineParts, priorities, statuses } from '@/lib/tasks';
import type { TaskPriority, TaskRecord, TaskStatus } from '@/lib/tasks';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useI18n } from '@/providers/LanguageProvider';

export type TaskInput = {
  title: string;
  subject: string;
  description: string | null;
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  reminderOffsetMinutes: ReminderOffset;
};

type FieldErrors = Partial<Record<'title' | 'subject' | 'deadline' | 'priority' | 'status', string>>;
const hourOptions = Array.from({ length: 24 }, (_, i) => ({ id: String(i).padStart(2, '0'), label: String(i).padStart(2, '0') }));
const minuteOptions = Array.from({ length: 60 }, (_, i) => ({ id: String(i).padStart(2, '0'), label: String(i).padStart(2, '0') }));

export function TaskForm({ initial, onSave, editing = false }: { initial?: TaskRecord; onSave: (input: TaskInput) => Promise<boolean>; editing?: boolean }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const { session } = useAuth();
  const [semesterSubjects, setSemesterSubjects] = useState<StudentSemesterCourse[]>([]);
  const [semesterChosen, setSemesterChosen] = useState(false);
  const [semesterLoadError, setSemesterLoadError] = useState(false);
  const [defaults] = useState(() => localDeadlineParts(initial?.deadline ?? new Date(Date.now() + 3600000).toISOString()));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(defaults.date);
  const [hour, setHour] = useState(defaults.hour);
  const [minute, setMinute] = useState(defaults.minute);
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'pending');
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState<ReminderOffset>(
    isReminderOffset(initial?.reminder_offset_minutes) ? initial.reminder_offset_minutes : null,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    let active = true;
    void readSemesterChoice(userId).then(async (choice) => {
      if (!choice) return null;
      return loadStudentCourses(userId, choice);
    }).then((rows) => { if (active) { setSemesterSubjects(rows ?? []); setSemesterChosen(rows !== null); } })
      .catch(() => { if (active) setSemesterLoadError(true); });
    return () => { active = false; };
  }, [session?.user.id]);

  async function submit() {
    if (saving) return;
    const next: FieldErrors = {};
    const cleanedTitle = title.trim();
    const cleanedSubject = subject.trim();
    const iso = deadlineIso(date, hour, minute);
    if (!cleanedTitle) next.title = t('task.titleRequired');
    if (!cleanedSubject) next.subject = t('task.subjectRequired');
    if (!iso) next.deadline = t('task.deadlineRequired');
    if (!priorities.includes(priority)) next.priority = t('task.priorityRequired');
    if (!statuses.includes(status)) next.status = t('task.statusRequired');
    setErrors(next);
    setSaveError(false);
    if (Object.keys(next).length || !iso) return;
    setSaving(true);
    try {
      const ok = await onSave({ title: cleanedTitle, subject: cleanedSubject, description: description.trim() || null, deadline: iso, priority, status, reminderOffsetMinutes });
      if (!ok) setSaveError(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <ExpenseTextField label={t('task.title')} value={title} onChangeText={setTitle} placeholder={t('task.titlePlaceholder')} error={errors.title} maxLength={200} />
    <ExpenseTextField label={t('task.subject')} value={subject} onChangeText={setSubject} placeholder={t('task.subjectPlaceholder')} error={errors.subject} maxLength={200} />
    {semesterSubjects.length > 0 && <View style={styles.subjectChoices}><Text style={[styles.subjectHeading, { color: tokens.cardText }]}>{t('task.semesterSubjects')}</Text><Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('task.semesterHint')}</Text>
      {semesterSubjects.map((course) => <Pressable key={course.id} accessibilityRole="button" accessibilityLabel={t('task.useSubject', { subject: taskSubject(course) })} onPress={() => { setSubject(taskSubject(course)); setErrors((current) => ({ ...current, subject: undefined })); }} style={[styles.subjectChoice, { borderColor: tokens.border, backgroundColor: tokens.cardElevated }]}><Text style={[styles.subjectChoiceText, { color: tokens.cardText }]}>{taskSubject(course)}</Text></Pressable>)}
    </View>}
    {semesterChosen && !semesterSubjects.length && <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('task.semesterEmpty')}</Text>}
    {semesterLoadError && <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('task.semesterLoadError')}</Text>}
    <ExpenseTextField label={t('task.description')} value={description} onChangeText={setDescription} placeholder={t('task.descriptionPlaceholder')} multiline maxLength={2000} />
    <ExpenseDatePicker value={date} onChange={setDate} error={errors.deadline} label={t('task.deadline')} pickerTitle={t('task.chooseDeadline')} />
    <View style={styles.timeRow}>
      <View style={styles.timeField}><SelectionField label={t('task.hour')} value={hour} placeholder="--" options={hourOptions} onSelect={setHour} labelOnCard /></View>
      <View style={styles.timeField}><SelectionField label={t('task.minute')} value={minute} placeholder="--" options={minuteOptions} onSelect={setMinute} labelOnCard /></View>
    </View>
    <SelectionField label={t('task.priority')} value={priority} placeholder={t('task.priority')} options={priorities.map((id) => ({ id, label: t(`task.${id}`) }))} onSelect={(id) => setPriority(id as TaskPriority)} error={errors.priority} labelOnCard />
    <SelectionField label={t('task.status')} value={status} placeholder={t('task.status')} options={statuses.map((id) => ({ id, label: t(`task.${id}`) }))} onSelect={(id) => setStatus(id as TaskStatus)} error={errors.status} labelOnCard />
    <SelectionField label={t('task.reminder')} value={reminderOffsetMinutes === null ? 'none' : String(reminderOffsetMinutes)} placeholder={t('task.reminderNone')} options={[
      { id: 'none', label: t('task.reminderNone') }, { id: '0', label: t('task.reminderAtDeadline') },
      { id: '60', label: t('task.reminderHour') }, { id: '1440', label: t('task.reminderDay') },
    ]} onSelect={(id) => setReminderOffsetMinutes(id === 'none' ? null : Number(id) as ReminderOffset)} labelOnCard />
    <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('task.reminderHint')}</Text>
    {saveError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t('task.saveError')}</Text>}
    <PrimaryButton onPress={() => { void submit(); }} loading={saving}>{saving ? t('task.saving') : editing ? t('task.saveChanges') : t('task.save')}</PrimaryButton>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.radiusLg, borderWidth: 1, padding: spacing.space5, gap: spacing.space5 },
  timeRow: { flexDirection: 'row', gap: spacing.space3 }, timeField: { flex: 1 },
  error: { ...typography.label }, hint: { ...typography.label, lineHeight: 19, marginTop: -spacing.space3 },
  subjectChoices: { gap: spacing.space2 }, subjectHeading: { ...typography.label }, subjectChoice: { minHeight: 48, borderWidth: 1, borderRadius: radius.radiusSm, paddingHorizontal: spacing.space3, justifyContent: 'center' }, subjectChoiceText: { ...typography.body },
});
