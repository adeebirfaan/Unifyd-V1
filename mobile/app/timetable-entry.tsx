import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ClassFields } from '@/components/timetable/ClassFields';
import { radius, spacing, typography } from '@/constants/theme';
import { isAcademicSession, loadStudentCourses } from '@/lib/semesterCourses';
import type { Semester } from '@/lib/semesterCourses';
import { canonicalTime, draftFromEntry, draftToRow, emptyDraft, entrySlot, findClashes, validateDraft } from '@/lib/timetable';
import type { ClassDraft, SemesterSubject, TimetableEntry } from '@/lib/timetable';
import { loadTimetableEntries } from '@/lib/timetableEntries';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error' | 'notFound';

/** Add, edit, or delete one class in the student's own weekly timetable. */
export default function TimetableEntryScreen() {
  const { id, session: sessionParam, semester: semesterParam, day: dayParam, start: startParam, end: endParam } = useLocalSearchParams<{ id?: string; session?: string; semester?: string; day?: string; start?: string; end?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const academicSession = sessionParam?.trim() ?? '';
  const semester: Semester = semesterParam === '2' ? 2 : 1;
  const validChoice = isAcademicSession(academicSession) && (semesterParam === '1' || semesterParam === '2');
  const [state, setState] = useState<LoadState>('loading');
  const [subjects, setSubjects] = useState<SemesterSubject[]>([]);
  const [others, setOthers] = useState<TimetableEntry[]>([]);
  // A + cell in the week grid opens this form with its day and hour already filled in.
  const [draft, setDraft] = useState<ClassDraft>(() => {
    const day = Number(dayParam);
    return { ...emptyDraft('new'), day: day >= 1 && day <= 7 ? day : null, start: canonicalTime(startParam), end: canonicalTime(endParam) };
  });
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !validChoice) return;
    setState('loading');
    try {
      const choice = { academicSession, semester };
      const [courses, entries] = await Promise.all([loadStudentCourses(userId, choice), loadTimetableEntries(userId, choice)]);
      setSubjects(courses);
      if (id) {
        const entry = entries.find((row) => row.id === id);
        if (!entry) { setState('notFound'); return; }
        setDraft(draftFromEntry(entry));
      }
      setOthers(entries.filter((row) => row.id !== id));
      setState('ready');
    } catch { setState('error'); }
  }, [userId, validChoice, academicSession, semester, id]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(); });
    return () => { active = false; };
  }, [load]);

  const errors = validateDraft(draft);
  const clashNames = findClashes([{ key: draft.key, label: '', day: draft.day, start: draft.start, end: draft.end }, ...others.map(entrySlot)])
    .map(([, other]) => other.label);

  async function save() {
    if (!userId || busy) return;
    setShowErrors(true); setError(null);
    if (errors.length) return;
    setBusy(true);
    try {
      const row = draftToRow(draft, userId, academicSession, semester);
      if (id) {
        // Ownership and import source are fixed once a class is saved.
        const { user_id: _owner, entry_source: _source, ...changes } = row;
        const { data, error: updateError } = await supabase.from('timetable_entries').update(changes).eq('id', id).eq('user_id', userId).select('id').maybeSingle();
        if (updateError || !data) throw updateError ?? new Error('not found');
      } else {
        const { error: insertError } = await supabase.from('timetable_entries').insert(row);
        if (insertError) throw insertError;
      }
      router.dismissTo({ pathname: '/timetable', params: { [id ? 'updated' : 'saved']: '1' } });
    } catch { setError(t('timetable.saveError')); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!userId || !id || busy) return;
    setBusy(true); setError(null);
    try {
      const { data, error: deleteError } = await supabase.from('timetable_entries').delete().eq('id', id).eq('user_id', userId).select('id').maybeSingle();
      if (deleteError || !data) throw deleteError ?? new Error('not found');
      setConfirming(false);
      router.dismissTo({ pathname: '/timetable', params: { deleted: '1' } });
    } catch { setError(t('timetable.deleteError')); }
    finally { setBusy(false); }
  }

  const card = [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];
  return <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('semester.eyebrow')}</Text>
      <Text style={[styles.title, { color: tokens.screenText }]} accessibilityRole="header">{t(id ? 'timetable.editTitle' : 'timetable.addTitle')}</Text>
      {!validChoice ? <View style={card}><Text style={[styles.muted, { color: tokens.cardText }]}>{t('timetable.needSession')}</Text></View>
        : state === 'loading' ? <View style={card}><ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('timetable.loading')}</Text></View>
          : state !== 'ready' ? <View style={card}><Text style={[styles.muted, { color: tokens.cardText }]}>{t(state === 'notFound' ? 'timetable.notFound' : 'timetable.loadError')}</Text><PrimaryButton onPress={() => { void load(); }}>{t('timetable.retry')}</PrimaryButton></View>
            : <>
              <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('timetable.savingTo', { session: academicSession, semester })}</Text>
              <View style={card}>
                <ClassFields draft={draft} onChange={setDraft} subjects={subjects} errors={showErrors ? errors : []} clashNames={clashNames} />
              </View>
              {error && !confirming && <Text style={[styles.error, { color: tokens.errorText }]} accessibilityRole="alert">{error}</Text>}
              <PrimaryButton onPress={() => { void save(); }} loading={busy && !confirming}>{busy && !confirming ? t('timetable.saving') : t('timetable.save')}</PrimaryButton>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.back()} style={styles.cancel}><Text style={[styles.cancelText, { color: tokens.mutedText }]}>{t('timetable.cancel')}</Text></Pressable>
              {id && <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setError(null); setConfirming(true); }} style={[styles.deleteButton, { borderColor: tokens.border }]}>
                <Ionicons name="trash-outline" size={20} color={tokens.errorText} /><Text style={[styles.deleteText, { color: tokens.errorText }]}>{t('timetable.delete')}</Text>
              </Pressable>}
            </>}
    </ScrollView>
    <Modal visible={confirming} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirming(false); }}><View style={styles.dialogRoot}>
      <Pressable style={[styles.scrim, { backgroundColor: tokens.modalScrim }]} disabled={busy} onPress={() => setConfirming(false)} />
      <View style={[styles.dialog, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} accessibilityViewIsModal>
        <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('timetable.deleteConfirm')}</Text>
        <Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('timetable.deleteBody', { name: draft.courseName })}</Text>
        {error && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{error}</Text>}
        <View style={styles.dialogActions}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirming(false)} style={[styles.dialogButton, { backgroundColor: tokens.cardElevated }]}><Text style={[styles.deleteText, { color: tokens.cardText }]}>{t('timetable.cancel')}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void remove(); }} style={[styles.dialogButton, { backgroundColor: tokens.destructiveBackground }]}>{busy ? <ActivityIndicator color={tokens.destructiveForeground} /> : <Text style={[styles.deleteText, { color: tokens.destructiveForeground }]}>{t('timetable.delete')}</Text>}</Pressable>
        </View>
      </View>
    </View></Modal>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, content: { width: '100%', maxWidth: 568, alignSelf: 'center', paddingHorizontal: spacing.space6, gap: spacing.space4 },
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space2 }, eyebrow: { ...typography.label, letterSpacing: 2 },
  title: { ...typography.screenTitle }, helper: { ...typography.body, lineHeight: 23 },
  card: { borderRadius: radius.radiusLg, borderWidth: 1, padding: spacing.space5, gap: spacing.space4 }, cardTitle: { ...typography.sectionTitle },
  muted: { ...typography.body, lineHeight: 22 }, error: { ...typography.label },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, cancelText: { ...typography.body, fontWeight: '600' },
  deleteButton: { minHeight: 54, borderRadius: radius.radiusMd, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2 }, deleteText: { ...typography.body, fontWeight: '700' },
  dialogRoot: { flex: 1, justifyContent: 'center', padding: spacing.space5 }, scrim: { ...StyleSheet.absoluteFill },
  dialog: { width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: radius.radiusLg, borderWidth: 1, padding: spacing.space5, gap: spacing.space4 },
  dialogActions: { flexDirection: 'row', gap: spacing.space3 }, dialogButton: { flex: 1, minHeight: 50, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center' },
});
