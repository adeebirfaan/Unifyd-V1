import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ClassFields, dayShortKey } from '@/components/timetable/ClassFields';
import type { TranslationKey } from '@/constants/i18n';
import { radius, spacing, typography } from '@/constants/theme';
import { isAcademicSession, loadStudentCourses } from '@/lib/semesterCourses';
import type { Semester } from '@/lib/semesterCourses';
import { canonicalTime, draftFromCandidate, draftsToSave, draftToRow, emptyDraft, entrySlot, findClashes, validateDraft } from '@/lib/timetable';
import type { ClashSlot, ClassDraft, SemesterSubject, TimetableEntry } from '@/lib/timetable';
import { loadTimetableEntries } from '@/lib/timetableEntries';
import { fromPhoto, importTimetable, TIMETABLE_MAX_BYTES, TIMETABLE_TYPES, TimetableImportError } from '@/lib/timetableImport';
import type { TimetableFile, TimetableImportErrorCode } from '@/lib/timetableImport';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const errorKeys: Record<TimetableImportErrorCode, TranslationKey> = {
  notConfigured: 'timetable.errorNotConfigured', unsupported: 'timetable.errorUnsupported', tooLarge: 'timetable.errorTooLarge',
  protected: 'timetable.errorProtected', invalidDocument: 'timetable.errorInvalid', authRequired: 'timetable.errorAuth', unavailable: 'timetable.errorUnavailable',
};

/** Removes the picker's temporary copy so the timetable file is not kept on the device (never the original photo or file). */
function discardPickedFile(asset: TimetableFile | null) {
  if (!asset || Platform.OS === 'web') return;
  try { const file = new File(asset.uri); if (file.exists) file.delete(); } catch { /* the OS clears its cache later */ }
}

/**
 * Import a timetable: the file is read once by the Unifyd server, then every
 * extracted class must be reviewed here. Nothing is saved until the student
 * presses Save, and only the reviewed details are stored.
 */
export default function TimetableImportScreen() {
  const { session: sessionParam, semester: semesterParam } = useLocalSearchParams<{ session?: string; semester?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const academicSession = sessionParam?.trim() ?? '';
  const semester: Semester = semesterParam === '2' ? 2 : 1;
  const validChoice = isAcademicSession(academicSession) && (semesterParam === '1' || semesterParam === '2');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [subjects, setSubjects] = useState<SemesterSubject[]>([]);
  const [existing, setExisting] = useState<TimetableEntry[]>([]);
  const [asset, setAsset] = useState<TimetableFile | null>(null);
  const [busy, setBusy] = useState<'picking' | 'reading' | 'saving' | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [drafts, setDrafts] = useState<ClassDraft[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pagesProcessed, setPagesProcessed] = useState(0);
  const [leftOut, setLeftOut] = useState<Set<string>>(() => new Set());
  // Classes show as one-line summaries; details open only when the student wants to edit.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const nextKey = useRef(0);
  const assetRef = useRef(asset);
  useEffect(() => { assetRef.current = asset; }, [asset]);
  useEffect(() => () => discardPickedFile(assetRef.current), []);

  const load = useCallback(async () => {
    if (!userId || !validChoice) return;
    setLoadState('loading');
    try {
      const choice = { academicSession, semester };
      const [courses, entries] = await Promise.all([loadStudentCourses(userId, choice), loadTimetableEntries(userId, choice)]);
      setSubjects(courses); setExisting(entries); setLoadState('ready');
    } catch { setLoadState('error'); }
  }, [userId, validChoice, academicSession, semester]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(); });
    return () => { active = false; };
  }, [load]);

  // iOS opens the Files app for documents, which cannot reach the Photos library,
  // so images saved in Photos have their own picker.
  async function pick(source: 'photos' | 'files') {
    if (busy) return;
    setBusy('picking'); setErrorKey(null);
    try {
      let chosen: TimetableFile;
      if (source === 'photos') {
        const picked = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'], allowsEditing: false, allowsMultipleSelection: false, quality: 1,
          // Converts iPhone HEIC photos to JPEG, which the server accepts.
          preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        });
        if (picked.canceled || !picked.assets[0]) return;
        chosen = fromPhoto(picked.assets[0]);
      } else {
        const picked = await DocumentPicker.getDocumentAsync({ type: [...TIMETABLE_TYPES], multiple: false, copyToCacheDirectory: true });
        if (picked.canceled || !picked.assets[0]) return;
        chosen = picked.assets[0];
      }
      discardPickedFile(asset);
      setAsset(chosen);
      if ((chosen.size ?? chosen.file?.size ?? 0) > TIMETABLE_MAX_BYTES) setErrorKey('timetable.errorTooLarge');
    } catch { setErrorKey('timetable.errorPick'); }
    finally { setBusy(null); }
  }

  async function read() {
    if (!asset || busy) return;
    setBusy('reading'); setErrorKey(null);
    try {
      const result = await importTimetable(asset);
      const read = result.candidates.map((candidate) => draftFromCandidate(candidate, subjects));
      setDrafts(read);
      // Only classes that still need details start open.
      setExpanded(new Set(read.filter((draft) => validateDraft(draft).length > 0).map((draft) => draft.key)));
      setWarnings(result.warnings); setPagesProcessed(result.pagesProcessed); setLeftOut(new Set());
      // The file is no longer needed once its text has been read.
      discardPickedFile(asset); setAsset(null);
    } catch (error) {
      setErrorKey(error instanceof TimetableImportError ? errorKeys[error.code] : 'timetable.errorUnavailable');
    } finally { setBusy(null); }
  }

  const updateDraft = (next: ClassDraft) => setDrafts((current) => current?.map((draft) => draft.key === next.key ? next : draft) ?? null);
  const removeDraft = (key: string) => setDrafts((current) => current?.filter((draft) => draft.key !== key) ?? null);
  const addDraft = () => {
    const key = `added-${++nextKey.current}`;
    setDrafts((current) => [...(current ?? []), emptyDraft(key)]);
    setExpanded((current) => new Set(current).add(key));
  };
  const toggleExpanded = (key: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const toggleLeftOut = (key: string) => setLeftOut((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // Only complete classes the student keeps ticked are saved; the rest are simply left out.
  const toSave = draftsToSave(drafts ?? [], leftOut);
  const notSaved = (drafts?.length ?? 0) - toSave.length;
  const slotOf = (draft: ClassDraft, index: number): ClashSlot => ({ key: draft.key, label: draft.courseCode.trim() || draft.courseName.trim() || t('timetable.classNumber', { number: index + 1 }), day: draft.day, start: draft.start, end: draft.end });
  const savedSlots = existing.map(entrySlot);
  const keptSlots = (drafts ?? []).map(slotOf).filter((slot) => toSave.some((draft) => draft.key === slot.key));
  const clashes = findClashes([...keptSlots, ...savedSlots]);
  const clashNamesFor = (draft: ClassDraft, index: number) => findClashes([slotOf(draft, index), ...keptSlots.filter((slot) => slot.key !== draft.key), ...savedSlots])
    .filter(([a, b]) => a.key === draft.key || b.key === draft.key).map(([a, b]) => a.key === draft.key ? b.label : a.label);

  async function save() {
    if (!userId || !drafts || busy) return;
    setErrorKey(null);
    if (!toSave.length) { setErrorKey('timetable.noneToSave'); return; }
    setBusy('saving');
    try {
      const { error } = await supabase.from('timetable_entries').insert(toSave.map((draft) => draftToRow(draft, userId, academicSession, semester)));
      if (error) throw error;
      router.dismissTo({ pathname: '/timetable', params: { imported: String(toSave.length) } });
    } catch { setErrorKey('timetable.saveError'); }
    finally { setBusy(null); }
  }

  const card = [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];
  const warningText = (warning: string) => warning === 'NO_CLASSES_FOUND' ? t('timetable.warnNoClasses') : warning === 'INCOMPLETE_DETAILS' ? t('timetable.warnIncomplete')
    : warning === 'PAGES_TRUNCATED' ? t('timetable.warnTruncated', { count: pagesProcessed }) : null;

  return <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} disabled={busy === 'saving'} onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('semester.eyebrow')}</Text>
      <Text style={[styles.title, { color: tokens.screenText }]} accessibilityRole="header">{t(drafts ? 'timetable.reviewTitle' : 'timetable.import')}</Text>
      {!validChoice ? <View style={card}><Text style={[styles.muted, { color: tokens.cardText }]}>{t('timetable.needSession')}</Text></View>
        : loadState === 'loading' ? <View style={card}><ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('timetable.loading')}</Text></View>
          : loadState === 'error' ? <View style={card}><Text style={[styles.muted, { color: tokens.cardText }]}>{t('timetable.loadError')}</Text><PrimaryButton onPress={() => { void load(); }}>{t('timetable.retry')}</PrimaryButton></View>
            : !drafts ? <>
              <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('timetable.importHelper')}</Text>
              <View style={styles.notice}><Ionicons name="lock-closed-outline" size={18} color={tokens.mutedText} /><Text style={[styles.noticeText, { color: tokens.mutedText }]}>{t('timetable.importPrivacy')}</Text></View>
              <View style={card}>
                {asset && <View style={styles.row}><Ionicons name={asset.name.toLowerCase().endsWith('.pdf') ? 'document-text-outline' : 'image-outline'} size={22} color={tokens.brandCyan} /><Text style={[styles.fileName, { color: tokens.cardText }]} numberOfLines={2}>{t('timetable.selectedFile', { name: asset.name })}</Text></View>}
                {([['photos', 'images-outline', 'timetable.choosePhoto'], ['files', 'folder-open-outline', 'timetable.chooseFile']] as const).map(([source, icon, label]) =>
                  <Pressable key={source} accessibilityRole="button" disabled={!!busy} onPress={() => { void pick(source); }} style={[styles.secondaryButton, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
                    <Ionicons name={icon} size={20} color={tokens.brandCyan} />
                    <Text style={[styles.secondaryText, { color: tokens.cardText }]}>{t(label)}</Text>
                  </Pressable>)}
                {busy === 'picking' && <ActivityIndicator color={tokens.brandCyan} />}
                {errorKey && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t(errorKey)}</Text>}
                <PrimaryButton onPress={() => { void read(); }} loading={busy === 'reading'} disabled={!asset || errorKey === 'timetable.errorTooLarge'}>{t('timetable.read')}</PrimaryButton>
                {busy === 'reading' && <Text style={[styles.muted, { color: tokens.cardMutedText }]} accessibilityLiveRegion="polite">{t('timetable.reading')}</Text>}
              </View>
            </> : <>
              <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('timetable.reviewHelper')}</Text>
              <Text style={[styles.noticeText, { color: tokens.mutedText }]}>{t('timetable.savingTo', { session: academicSession, semester })}</Text>
              {warnings.map(warningText).filter(Boolean).map((text) => <View key={text} style={[styles.warning, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Ionicons name="alert-circle-outline" size={19} color={tokens.cardErrorText} /><Text style={[styles.warningText, { color: tokens.cardText }]}>{text}</Text></View>)}
              {clashes.length > 0 && <View style={[styles.warning, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Ionicons name="time-outline" size={19} color={tokens.cardErrorText} /><Text style={[styles.warningText, { color: tokens.cardText }]}>{t('timetable.reviewClashes')}</Text></View>}
              {drafts.map((draft, index) => {
                const errors = validateDraft(draft);
                const complete = errors.length === 0;
                const kept = complete && !leftOut.has(draft.key);
                const open = expanded.has(draft.key);
                const clashNames = kept ? clashNamesFor(draft, index) : [];
                const when = draft.day && canonicalTime(draft.start) && canonicalTime(draft.end) ? `${t(dayShortKey(draft.day))} ${canonicalTime(draft.start)}–${canonicalTime(draft.end)}` : null;
                const meta = [when, draft.location.trim(), draft.section.trim() && t('timetable.sectionShort', { section: draft.section.trim() })].filter(Boolean).join(' · ');
                return <View key={draft.key} style={[styles.reviewCard, { backgroundColor: tokens.cardBackground, borderColor: kept ? tokens.brandCyan : tokens.border }]} testID="review-class">
                  <View style={styles.summary}>
                    <Pressable accessibilityRole="checkbox" accessibilityLabel={t('timetable.includeLabel', { number: index + 1 })} aria-checked={kept} aria-disabled={!complete || !!busy} disabled={!complete || !!busy} onPress={() => toggleLeftOut(draft.key)} style={styles.check}>
                      <Ionicons name={kept ? 'checkbox' : 'square-outline'} size={26} color={complete ? tokens.brandCyan : tokens.cardMutedText} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={t(open ? 'timetable.hideClass' : 'timetable.editClass', { number: index + 1 })} disabled={!!busy} onPress={() => toggleExpanded(draft.key)} style={styles.summaryText}>
                      <Text style={[styles.summaryTitle, { color: tokens.cardText }]} numberOfLines={2}>{[draft.courseCode.trim(), draft.courseName.trim()].filter(Boolean).join(' · ') || t('timetable.classNumber', { number: index + 1 })}</Text>
                      {!!meta && <Text style={[styles.summaryMeta, { color: tokens.cardMutedText }]} numberOfLines={2}>{meta}</Text>}
                      <Text style={[styles.includeStatus, { color: kept ? tokens.successText : tokens.cardMutedText }]}>{t(kept ? 'timetable.statusKept' : complete ? 'timetable.statusLeftOut' : 'timetable.statusIncomplete')}</Text>
                      {!open && clashNames.length > 0 && <Text style={[styles.includeStatus, { color: tokens.cardErrorText }]}>{t('timetable.clashWarning', { names: clashNames.join(', ') })}</Text>}
                    </Pressable>
                    <View style={styles.summaryActions}>
                      <Pressable accessibilityRole="button" accessibilityLabel={t(open ? 'timetable.hideClass' : 'timetable.editClass', { number: index + 1 })} disabled={!!busy} onPress={() => toggleExpanded(draft.key)} style={styles.remove}><Ionicons name={open ? 'chevron-up' : 'create-outline'} size={21} color={tokens.brandCyan} /></Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={t('timetable.removeClass', { number: index + 1 })} disabled={!!busy} onPress={() => removeDraft(draft.key)} style={styles.remove}><Ionicons name="trash-outline" size={21} color={tokens.cardErrorText} /></Pressable>
                    </View>
                  </View>
                  {open && <View style={styles.details}><ClassFields draft={draft} onChange={updateDraft} subjects={subjects} errors={errors} clashNames={clashNames} /></View>}
                </View>;
              })}
              <Pressable accessibilityRole="button" disabled={!!busy} onPress={addDraft} style={[styles.secondaryButton, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
                <Ionicons name="add-circle-outline" size={20} color={tokens.brandCyan} /><Text style={[styles.secondaryText, { color: tokens.cardText }]}>{t('timetable.addAnother')}</Text>
              </Pressable>
              {notSaved > 0 && toSave.length > 0 && <Text style={[styles.noticeText, { color: tokens.mutedText }]}>{t('timetable.notSavedCount', { count: notSaved })}</Text>}
              {!toSave.length && <Text style={[styles.noticeText, { color: tokens.mutedText }]}>{t('timetable.noneToSave')}</Text>}
              {errorKey && <Text style={[styles.error, { color: tokens.errorText }]} accessibilityRole="alert">{t(errorKey)}</Text>}
              <PrimaryButton onPress={() => { void save(); }} loading={busy === 'saving'} disabled={!toSave.length}>{busy === 'saving' ? t('timetable.saving') : t(toSave.length === 1 ? 'timetable.saveOne' : 'timetable.saveAll', { count: toSave.length })}</PrimaryButton>
              <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => router.back()} style={styles.discard}><Text style={[styles.discardText, { color: tokens.mutedText }]}>{t('timetable.discard')}</Text></Pressable>
            </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, content: { width: '100%', maxWidth: 568, alignSelf: 'center', paddingHorizontal: spacing.space6, gap: spacing.space4 },
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space2 }, eyebrow: { ...typography.label, letterSpacing: 2 },
  title: { ...typography.screenTitle }, helper: { ...typography.body, lineHeight: 23 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2 }, noticeText: { ...typography.label, flex: 1, lineHeight: 20 },
  card: { borderRadius: radius.radiusLg, borderWidth: 1, padding: spacing.space5, gap: spacing.space4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }, cardTitle: { ...typography.sectionTitle, flex: 1 },
  badge: { ...typography.label, borderRadius: radius.radiusFull, paddingHorizontal: spacing.space3, paddingVertical: spacing.space1, overflow: 'hidden' },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  reviewCard: { borderRadius: radius.radiusMd, borderWidth: 1, paddingVertical: spacing.space2, paddingLeft: spacing.space1, paddingRight: spacing.space1 },
  summary: { flexDirection: 'row', alignItems: 'flex-start' }, check: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  summaryText: { flex: 1, minHeight: 44, justifyContent: 'center', gap: 2, paddingVertical: spacing.space1 }, summaryTitle: { ...typography.body, fontWeight: '700', lineHeight: 21 },
  summaryMeta: { ...typography.label, lineHeight: 19 }, summaryActions: { flexDirection: 'row' }, details: { paddingHorizontal: spacing.space3, paddingTop: spacing.space3, paddingBottom: spacing.space2 },
  includeStatus: { ...typography.label, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }, fileName: { ...typography.body, flex: 1 },
  muted: { ...typography.body, lineHeight: 22 }, error: { ...typography.label },
  secondaryButton: { minHeight: 54, borderRadius: radius.radiusMd, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2 },
  secondaryText: { ...typography.body, fontWeight: '700' },
  warning: { borderWidth: 1, borderRadius: radius.radiusMd, padding: spacing.space3, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2 }, warningText: { ...typography.body, flex: 1, lineHeight: 22 },
  discard: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, discardText: { ...typography.body, fontWeight: '600' },
});
