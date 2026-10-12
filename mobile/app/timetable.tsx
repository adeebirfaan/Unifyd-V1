import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { SelectionField } from '@/components/profile/SelectionField';
import { dayKey } from '@/components/timetable/ClassFields';
import { NextClassCard } from '@/components/timetable/NextClassCard';
import { WeekGrid } from '@/components/timetable/WeekGrid';
import { ExpenseTextField } from '@/components/wallet/ExpenseTextField';
import { radius, spacing, typography } from '@/constants/theme';
import { isAcademicSession, loadCatalogSessions, readSemesterChoice, writeSemesterChoice } from '@/lib/semesterCourses';
import type { Semester } from '@/lib/semesterCourses';
import { entrySlot, findClashes } from '@/lib/timetable';
import type { TimetableEntry } from '@/lib/timetable';
import { loadTimetableEntries } from '@/lib/timetableEntries';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error';

export default function TimetableScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { saved, updated, deleted, imported } = useLocalSearchParams<{ saved?: string; updated?: string; deleted?: string; imported?: string }>();
  const [sessions, setSessions] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [academicSession, setAcademicSession] = useState('');
  const [semester, setSemester] = useState<Semester>(1);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const version = useRef(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    // The session list is a convenience; a failure falls back to typing the session.
    void Promise.all([loadCatalogSessions().catch(() => [] as string[]), readSemesterChoice(userId)]).then(([available, choice]) => {
      if (!active) return;
      setSessions(available);
      setAcademicSession(choice?.academicSession ?? (available.length === 1 ? available[0]! : ''));
      setSemester(choice?.semester ?? 1);
      setInitialized(true);
    });
    return () => { active = false; };
  }, [userId]);

  const load = useCallback(async (pull = false) => {
    if (!initialized) return;
    const request = ++version.current;
    if (!userId || !isAcademicSession(academicSession)) { setEntries([]); setState('ready'); return; }
    if (pull) setRefreshing(true); else setState('loading');
    try {
      const rows = await loadTimetableEntries(userId, { academicSession: academicSession.trim(), semester });
      if (request !== version.current) return;
      setEntries(rows); setState('ready');
    } catch { if (request === version.current) setState('error'); }
    finally { if (request === version.current) setRefreshing(false); }
  }, [initialized, userId, academicSession, semester]);

  useFocusEffect(useCallback(() => {
    void load();
    const versions = version;
    return () => { ++versions.current; };
  }, [load]));
  useEffect(() => {
    if (userId && isAcademicSession(academicSession)) void writeSemesterChoice(userId, { academicSession: academicSession.trim(), semester }).catch(() => undefined);
  }, [userId, academicSession, semester]);

  const validSession = isAcademicSession(academicSession);
  const params = { session: academicSession.trim(), semester: String(semester) };
  const sessionOptions = [...new Set([...sessions, ...(academicSession ? [academicSession] : [])])].map((id) => ({ id, label: id }));
  const clashes = findClashes(entries.map(entrySlot));
  const clashing = new Set(clashes.flatMap(([a, b]) => [a.key, b.key]));
  const pad = (value: number) => String(value).padStart(2, '0');
  const feedback = saved ? t('timetable.saved') : updated ? t('timetable.updated') : deleted ? t('timetable.deleted') : imported ? t('timetable.importSaved', { count: imported }) : null;
  const card = [styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];

  return <ScrollView style={{ backgroundColor: tokens.screenBackground }} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={tokens.brandCyan} colors={[tokens.brandBlue]} />} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
    <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('semester.eyebrow')}</Text>
    <Text style={[styles.title, { color: tokens.screenText }]} accessibilityRole="header">{t('timetable.title')}</Text>
    <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('timetable.helper')}</Text>
    <View style={[card, styles.selectors]}>
      {sessionOptions.length ? <SelectionField label={t('semester.session')} value={academicSession || null} placeholder={t('semester.sessionPlaceholder')} options={sessionOptions} onSelect={setAcademicSession} labelOnCard />
        : <><ExpenseTextField label={t('semester.sessionManual')} value={academicSession} onChangeText={setAcademicSession} placeholder="2026/2027" maxLength={9} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('semester.sessionManualHint')}</Text></>}
      <SelectionField label={t('semester.semester')} value={String(semester)} placeholder={t('semester.semester1')} options={[{ id: '1', label: t('semester.semester1') }, { id: '2', label: t('semester.semester2') }]} onSelect={(id) => setSemester(Number(id) as Semester)} labelOnCard />
    </View>
    <View style={styles.actions}>
      <View style={styles.action}><PrimaryButton onPress={() => router.push({ pathname: '/timetable-import', params })} disabled={!validSession}>{t('timetable.import')}</PrimaryButton></View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !validSession }} disabled={!validSession} onPress={() => router.push({ pathname: '/timetable-entry', params })}
        style={[styles.secondaryButton, styles.action, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }, !validSession && styles.dimmed]}>
        <Ionicons name="add-circle-outline" size={20} color={tokens.brandCyan} /><Text style={[styles.secondaryText, { color: tokens.cardText }]}>{t('timetable.add')}</Text>
      </Pressable>
    </View>
    {feedback && <Text style={[styles.feedback, { color: tokens.successText }]} accessibilityRole="alert">{feedback}</Text>}
    {!validSession ? <View style={card}><Ionicons name="calendar-outline" size={28} color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('timetable.chooseSession')}</Text></View>
      : state === 'loading' ? <View style={card}><ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('timetable.loading')}</Text></View>
        : state === 'error' ? <View style={card}><Text style={[styles.muted, { color: tokens.cardText }]}>{t('timetable.loadError')}</Text><PrimaryButton onPress={() => { void load(); }}>{t('timetable.retry')}</PrimaryButton></View>
          : <>
            <NextClassCard entries={entries} />
            {!entries.length && <View style={card} testID="timetable-empty"><Ionicons name="calendar-outline" size={28} color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('timetable.empty')}</Text></View>}
            <View style={styles.gridWrap}>
              <WeekGrid entries={entries} clashing={clashing}
                onOpen={(entry) => router.push({ pathname: '/timetable-entry', params: { ...params, id: entry.id } })}
                onAdd={(day, hour) => router.push({ pathname: '/timetable-entry', params: { ...params, day: String(day), start: `${pad(hour)}:00`, end: `${pad(hour)}:50` } })} />
            </View>
            {clashes.length > 0 && <View style={card} testID="timetable-clashes">
              <View style={styles.row}><Ionicons name="alert-circle-outline" size={20} color={tokens.cardErrorText} /><Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('timetable.clashTitle')}</Text></View>
              <Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('timetable.clashHelper')}</Text>
              {clashes.map(([a, b]) => <Text key={`${a.key}-${b.key}`} style={[styles.muted, { color: tokens.cardErrorText }]}>{t('timetable.clashPair', { a: a.label, b: b.label, day: t(dayKey(a.day!)) })}</Text>)}
            </View>}
          </>}
    <View style={styles.notice}><Ionicons name="information-circle-outline" size={19} color={tokens.mutedText} /><Text style={[styles.noticeText, { color: tokens.mutedText }]}>{t('timetable.notOfficial')}</Text></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 568, alignSelf: 'center', paddingHorizontal: spacing.space6, gap: spacing.space4 },
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space2 }, eyebrow: { ...typography.label, letterSpacing: 2 },
  title: { ...typography.screenTitle }, helper: { ...typography.body, lineHeight: 23 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2 }, noticeText: { ...typography.label, flex: 1, lineHeight: 20 },
  card: { borderRadius: radius.radiusLg, borderWidth: 1, padding: spacing.space5, gap: spacing.space3 }, cardTitle: { ...typography.sectionTitle, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }, muted: { ...typography.body, lineHeight: 22 },
  selectors: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.space4 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space3 }, action: { flexGrow: 1, flexBasis: 150 },
  gridWrap: { marginHorizontal: -spacing.space4 }, secondaryButton: { minHeight: 54, borderRadius: radius.radiusMd, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2 },
  secondaryText: { ...typography.body, fontWeight: '700' }, dimmed: { opacity: 0.5 }, feedback: { ...typography.label },
});
