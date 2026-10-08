import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { SelectionField } from '@/components/profile/SelectionField';
import { ExpenseTextField } from '@/components/wallet/ExpenseTextField';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { creditSummary, isAcademicSession, loadCatalogCourses, loadCatalogSessions, loadStudentCourses, parseCreditHours, readSemesterChoice, writeSemesterChoice } from '@/lib/semesterCourses';
import type { CatalogCourse, Semester, StudentSemesterCourse } from '@/lib/semesterCourses';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error';
type FormState = 'new' | StudentSemesterCourse | null;

export default function MySemesterScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState(false);
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const requestVersion = useRef(0);
  const [academicSession, setAcademicSession] = useState('');
  const [semester, setSemester] = useState<Semester>(1);
  const [selected, setSelected] = useState<StudentSemesterCourse[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catalogState, setCatalogState] = useState<LoadState>('loading');
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormState>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [credits, setCredits] = useState('');
  const [fieldError, setFieldError] = useState<'name' | 'credits' | null>(null);
  const [confirm, setConfirm] = useState<StudentSemesterCourse | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void Promise.all([loadCatalogSessions(), readSemesterChoice(userId)]).then(([available, saved]) => {
      if (!active) return;
      setSessions(available);
      setAcademicSession(saved?.academicSession ?? (available.length === 1 ? available[0] : ''));
      setSemester(saved?.semester ?? 1);
      setInitialized(true);
    }).catch(() => { if (active) { setInitializationError(true); setState('error'); } });
    return () => { active = false; };
  }, [userId, initializationAttempt]);

  const loadSelected = useCallback(async (pull = false) => {
    if (!initialized) return;
    const request = ++requestVersion.current;
    if (!userId || !isAcademicSession(academicSession)) { setSelected([]); setState('ready'); return; }
    if (pull) setRefreshing(true); else setState('loading');
    try {
      const rows = await loadStudentCourses(userId, { academicSession: academicSession.trim(), semester });
      if (request !== requestVersion.current) return;
      setSelected(rows);
      setState('ready');
    } catch { if (request === requestVersion.current) setState('error'); }
    finally { if (request === requestVersion.current) setRefreshing(false); }
  }, [initialized, userId, academicSession, semester]);

  useEffect(() => {
    let active = true;
    const versions = requestVersion;
    void Promise.resolve().then(() => { if (active) return loadSelected(); });
    return () => { active = false; ++versions.current; };
  }, [loadSelected]);
  useEffect(() => {
    if (userId && isAcademicSession(academicSession)) void writeSemesterChoice(userId, { academicSession: academicSession.trim(), semester }).catch(() => undefined);
  }, [userId, academicSession, semester]);

  const summary = creditSummary(selected);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term ? catalog.filter((course) => `${course.course_code} ${course.course_name}`.toLocaleLowerCase().includes(term)) : catalog;
  }, [catalog, search]);
  const sessionOptions = [...new Set([...sessions, ...(academicSession ? [academicSession] : [])])].map((id) => ({ id, label: id }));

  async function openCatalog() {
    if (!isAcademicSession(academicSession)) { setActionError(t('semester.sessionFormat')); return; }
    setActionError(null); setSearch(''); setPickerOpen(true); setCatalogState('loading');
    try { setCatalog(await loadCatalogCourses({ academicSession: academicSession.trim(), semester })); setCatalogState('ready'); }
    catch { setCatalogState('error'); }
  }

  async function selectCatalog(course: CatalogCourse) {
    if (!userId || busy) return;
    setActionError(null);
    if (selected.some((row) => row.catalog_course_id === course.id)) { setActionError(t('semester.alreadySelected')); return; }
    setBusy(true);
    try {
      const existing = await supabase.from('student_semester_courses').select('id').eq('user_id', userId)
        .eq('academic_session', academicSession.trim()).eq('semester', semester).eq('catalog_course_id', course.id).limit(1);
      if (existing.error) throw existing.error;
      if (existing.data?.length) { setActionError(t('semester.alreadySelected')); return; }
      const { error } = await supabase.from('student_semester_courses').insert({
        user_id: userId, academic_session: academicSession.trim(), semester,
        catalog_course_id: course.id, course_code: course.course_code, course_name: course.course_name,
        credit_hours: course.credit_hours, is_custom: false,
      });
      if (error) throw error;
      setPickerOpen(false); setFeedback(t('semester.subjectSaved'));
      await loadSelected(true);
    } catch { setActionError(t('semester.saveError')); }
    finally { setBusy(false); }
  }

  function openForm(course: FormState) {
    if (!isAcademicSession(academicSession)) { setActionError(t('semester.sessionFormat')); return; }
    setForm(course); setName(typeof course === 'object' && course ? course.course_name : '');
    setCode(typeof course === 'object' && course ? course.course_code ?? '' : '');
    setCredits(typeof course === 'object' && course ? course.credit_hours?.toString() ?? '' : '');
    setFieldError(null); setActionError(null);
  }

  async function saveForm() {
    if (!userId || !form || busy) return;
    const cleanedName = name.trim();
    const parsedCredits = parseCreditHours(credits);
    if (!cleanedName) { setFieldError('name'); return; }
    if (parsedCredits === undefined) { setFieldError('credits'); return; }
    setFieldError(null); setActionError(null); setBusy(true);
    try {
      const fields = { course_code: code.trim() || null, course_name: cleanedName, credit_hours: parsedCredits };
      if (form === 'new') {
        const { error } = await supabase.from('student_semester_courses').insert({
          user_id: userId, academic_session: academicSession.trim(), semester,
          catalog_course_id: null, ...fields, is_custom: true,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('student_semester_courses').update(fields)
          .eq('id', form.id).eq('user_id', userId).select('id').maybeSingle();
        if (error || !data) throw error ?? new Error('not found');
      }
      setForm(null); setFeedback(t(form === 'new' ? 'semester.subjectSaved' : 'semester.subjectUpdated'));
      await loadSelected(true);
    } catch { setActionError(t('semester.saveError')); }
    finally { setBusy(false); }
  }

  async function deleteCourse() {
    if (!userId || !confirm || busy) return;
    setBusy(true); setActionError(null);
    try {
      const { data, error } = await supabase.from('student_semester_courses').delete()
        .eq('id', confirm.id).eq('user_id', userId).select('id').maybeSingle();
      if (error || !data) throw error ?? new Error('not found');
      setConfirm(null); setFeedback(t('semester.subjectDeleted'));
      await loadSelected(true);
    } catch { setActionError(t('semester.deleteError')); }
    finally { setBusy(false); }
  }

  return <View style={[styles.fill, { backgroundColor: tokens.screenBackground }]}>
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadSelected(true); }} tintColor={tokens.brandCyan} colors={[tokens.brandBlue]} />} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('semester.eyebrow')}</Text>
      <Text style={[styles.title, { color: tokens.screenText }]}>{t('semester.title')}</Text>
      <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('semester.helper')}</Text>
      <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        {sessionOptions.length ? <SelectionField label={t('semester.session')} value={academicSession || null} placeholder={t('semester.sessionPlaceholder')} options={sessionOptions} onSelect={setAcademicSession} labelOnCard />
          : <><ExpenseTextField label={t('semester.sessionManual')} value={academicSession} onChangeText={setAcademicSession} placeholder="2026/2027" maxLength={9} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('semester.sessionManualHint')}</Text></>}
        <SelectionField label={t('semester.semester')} value={String(semester)} placeholder={t('semester.semester1')} options={[{ id: '1', label: t('semester.semester1') }, { id: '2', label: t('semester.semester2') }]} onSelect={(id) => setSemester(Number(id) as Semester)} labelOnCard />
      </View>
      {actionError && !pickerOpen && !form && !confirm && <Text style={[styles.error, { color: tokens.errorText }]} accessibilityRole="alert">{actionError}</Text>}
      {feedback && <Text style={[styles.feedback, { color: tokens.successText }]} accessibilityRole="alert">{feedback}</Text>}
      <View style={styles.actions}><PrimaryButton onPress={() => { void openCatalog(); }} disabled={!isAcademicSession(academicSession)}>{t('semester.add')}</PrimaryButton>
        <Pressable accessibilityRole="button" onPress={() => openForm('new')} style={[styles.secondaryButton, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Ionicons name="add-circle-outline" size={20} color={tokens.brandCyan} /><Text style={[styles.secondaryText, { color: tokens.cardText }]}>{t('semester.addCustom')}</Text></Pressable></View>
      <Text style={[styles.section, { color: tokens.screenText }]}>{t('semester.selected')}</Text>
      {state === 'loading' ? <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('semester.loading')}</Text></View>
        : state === 'error' ? <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Text style={[styles.muted, { color: tokens.cardText }]}>{t('semester.loadError')}</Text><PrimaryButton onPress={() => { if (initializationError) { setInitialized(false); setInitializationError(false); setState('loading'); setInitializationAttempt((count) => count + 1); } else void loadSelected(); }}>{t('semester.retry')}</PrimaryButton></View>
          : <><View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('semester.knownCredits', { count: summary.knownTotal })}</Text>
            {summary.unknownCount > 0 && <Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('semester.unknownCredits', { count: summary.unknownCount })}</Text>}
            {summary.knownTotal > 19 && <View style={styles.notice}><Ionicons name="alert-circle-outline" size={20} color={colors.warning} /><Text style={[styles.muted, styles.noticeText, { color: colors.warning }]}>{t('semester.overNineteen')}</Text></View>}</View>
            {!selected.length ? <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Ionicons name="book-outline" size={28} color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('semester.empty')}</Text></View>
              : selected.map((course) => <View key={course.id} style={[styles.subjectCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('semester.openSubject', { name: course.course_name })} onPress={() => openForm(course)} style={styles.subjectMain}><Text style={[styles.subjectName, { color: tokens.cardText }]}>{course.course_name}</Text><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{course.course_code ?? t('semester.custom')} · {course.credit_hours === null ? t('semester.creditsUnknown') : t('semester.credits', { count: course.credit_hours })}</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t('semester.delete') + ' ' + course.course_name} onPress={() => { setActionError(null); setConfirm(course); }} style={styles.deleteIcon}><Ionicons name="trash-outline" size={21} color={tokens.cardErrorText} /></Pressable>
              </View>)}</>}
    </ScrollView>
    <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => { if (!busy) setPickerOpen(false); }}><View style={styles.modalRoot}><Pressable style={[styles.scrim, { backgroundColor: tokens.modalScrim }]} disabled={busy} onPress={() => setPickerOpen(false)} /><View style={[styles.sheet, { backgroundColor: tokens.cardBackground, borderColor: tokens.border, paddingBottom: Math.max(insets.bottom, spacing.space4) }]}>
      <View style={styles.modalHeader}><Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('semester.catalogTitle')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('semester.close')} onPress={() => setPickerOpen(false)} style={styles.close}><Ionicons name="close" size={23} color={tokens.cardText} /></Pressable></View>
      <ExpenseTextField label={t('semester.search')} value={search} onChangeText={setSearch} placeholder={t('semester.searchPlaceholder')} />
      {actionError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{actionError}</Text>}
      {catalogState === 'loading' ? <ActivityIndicator color={tokens.brandCyan} /> : catalogState === 'error' ? <><Text style={[styles.muted, { color: tokens.cardText }]}>{t('semester.catalogError')}</Text><PrimaryButton onPress={() => { void openCatalog(); }}>{t('semester.retry')}</PrimaryButton></> : <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
        {!filtered.length && <Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t(catalog.length ? 'semester.searchEmpty' : 'semester.catalogEmpty')}</Text>}
        {filtered.map((course) => <Pressable key={course.id} accessibilityRole="button" accessibilityLabel={t('semester.subjectPicker', { code: course.course_code, name: course.course_name })} accessibilityState={{ disabled: busy || selected.some((row) => row.catalog_course_id === course.id) }} disabled={busy} onPress={() => { void selectCatalog(course); }} style={[styles.catalogRow, { borderBottomColor: tokens.border }]}><Text style={[styles.catalogCode, { color: tokens.brandCyan }]}>{course.course_code}</Text><Text style={[styles.subjectName, { color: tokens.cardText }]}>{course.course_name}</Text><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{course.campus ? t('semester.campus', { campus: course.campus }) + ' · ' : ''}{course.credit_hours === null ? t('semester.creditsUnknown') : t('semester.credits', { count: course.credit_hours })}</Text>{selected.some((row) => row.catalog_course_id === course.id) && <Text style={[styles.muted, { color: tokens.brandCyan }]}>{t('semester.alreadySelected')}</Text>}</Pressable>)}
      </ScrollView>}
    </View></View></Modal>
    <Modal visible={form !== null} transparent animationType="slide" onRequestClose={() => { if (!busy) setForm(null); }}><View style={styles.modalRoot}><Pressable style={[styles.scrim, { backgroundColor: tokens.modalScrim }]} disabled={busy} onPress={() => setForm(null)} /><View style={[styles.sheet, { backgroundColor: tokens.cardBackground, borderColor: tokens.border, paddingBottom: Math.max(insets.bottom, spacing.space4) }]}>
      <View style={styles.modalHeader}><Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t(form === 'new' ? 'semester.addCustom' : 'semester.edit')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('semester.close')} onPress={() => setForm(null)} style={styles.close}><Ionicons name="close" size={23} color={tokens.cardText} /></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formFields}>
        <ExpenseTextField label={t('semester.subjectName')} value={name} onChangeText={setName} placeholder={t('semester.subjectNamePlaceholder')} error={fieldError === 'name' ? t('semester.nameRequired') : undefined} maxLength={200} />
        <ExpenseTextField label={t('semester.codeOptional')} value={code} onChangeText={setCode} placeholder={t('semester.codePlaceholder')} maxLength={40} />
        <ExpenseTextField label={t('semester.creditsOptional')} value={credits} onChangeText={setCredits} placeholder={t('semester.creditsPlaceholder')} keyboardType="number-pad" error={fieldError === 'credits' ? t('semester.creditsInvalid') : undefined} maxLength={5} />
        {actionError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{actionError}</Text>}
        <PrimaryButton onPress={() => { void saveForm(); }} loading={busy}>{busy ? t('semester.saving') : t('semester.save')}</PrimaryButton>
      </ScrollView>
    </View></View></Modal>
    <Modal visible={confirm !== null} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirm(null); }}><View style={styles.dialogRoot}><Pressable style={[styles.scrim, { backgroundColor: tokens.modalScrim }]} disabled={busy} onPress={() => setConfirm(null)} /><View style={[styles.dialog, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} accessibilityViewIsModal>
      <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('semester.deleteConfirm')}</Text><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('semester.deleteBody', { name: confirm?.course_name ?? '' })}</Text>
      {actionError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{actionError}</Text>}
      <View style={styles.dialogActions}><Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirm(null)} style={[styles.dialogButton, { backgroundColor: tokens.cardElevated }]}><Text style={[styles.secondaryText, { color: tokens.cardText }]}>{t('semester.cancel')}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => { void deleteCourse(); }} style={[styles.dialogButton, { backgroundColor: tokens.destructiveBackground }]}>{busy ? <ActivityIndicator color={tokens.destructiveForeground} /> : <Text style={[styles.secondaryText, { color: tokens.destructiveForeground }]}>{t('semester.delete')}</Text>}</Pressable></View>
    </View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, content: { width: '100%', maxWidth: 568, alignSelf: 'center', paddingHorizontal: spacing.space6, gap: spacing.space4 },
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space2 }, eyebrow: { ...typography.label, letterSpacing: 2 },
  title: { ...typography.screenTitle }, helper: { ...typography.body, lineHeight: 23, marginBottom: spacing.space2 },
  card: { borderRadius: radius.radiusLg, borderWidth: 1, padding: spacing.space5, gap: spacing.space4 },
  actions: { gap: spacing.space3 }, secondaryButton: { minHeight: 54, borderRadius: radius.radiusMd, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2 }, secondaryText: { ...typography.body, fontWeight: '700' },
  section: { ...typography.sectionTitle, marginTop: spacing.space3 }, cardTitle: { ...typography.sectionTitle }, muted: { ...typography.body, lineHeight: 22 }, notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2 }, noticeText: { flex: 1 }, error: { ...typography.label }, feedback: { ...typography.label },
  subjectCard: { borderRadius: radius.radiusLg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, subjectMain: { flex: 1, minHeight: 72, justifyContent: 'center', gap: spacing.space1, padding: spacing.space4 }, subjectName: { ...typography.body, fontWeight: '700', lineHeight: 22 }, deleteIcon: { width: 52, minHeight: 72, alignItems: 'center', justifyContent: 'center' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, scrim: { ...StyleSheet.absoluteFill }, sheet: { maxHeight: '84%', borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg, borderWidth: 1, paddingHorizontal: spacing.space5, paddingTop: spacing.space4, gap: spacing.space4 }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space2 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, pickerList: { flexGrow: 0 }, catalogRow: { paddingVertical: spacing.space4, minHeight: 70, borderBottomWidth: 1, gap: spacing.space1 }, catalogCode: { ...typography.label }, formFields: { gap: spacing.space4, paddingBottom: spacing.space4 },
  dialogRoot: { flex: 1, justifyContent: 'center', padding: spacing.space5 }, dialog: { width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: radius.radiusLg, borderWidth: 1, padding: spacing.space5, gap: spacing.space4 }, dialogActions: { flexDirection: 'row', gap: spacing.space3 }, dialogButton: { flex: 1, minHeight: 50, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center' },
});
