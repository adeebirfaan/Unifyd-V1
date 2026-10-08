import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ForYouCard } from '@/components/mind/ForYouCard';
import { LevelChoices } from '@/components/mind/LevelChoices';
import { MoodTrendCard } from '@/components/mind/MoodTrendCard';
import { radius, spacing, typography } from '@/constants/theme';
import { CHECK_IN_LEVELS, formatCheckInDate, isCheckInLevel, moodLabelKey, stressLabelKey } from '@/lib/moodEntries';
import type { CheckInLevel, MoodEntry } from '@/lib/moodEntries';
import { moodPeriodBounds, summarizeMoodTrend } from '@/lib/moodTrends';
import type { MoodTrend, TrendEntry, TrendPeriod } from '@/lib/moodTrends';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error';
type FormErrors = { mood?: string; stress?: string };
const moodIcons = ['sad-outline', 'sad-outline', 'remove-circle-outline', 'happy-outline', 'happy-outline'] as const;
const stressIcons = ['leaf-outline', 'leaf-outline', 'pulse-outline', 'pulse-outline', 'pulse-outline'] as const;
const TREND_PAGE_SIZE = 500;

export default function MindScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const insets = useSafeAreaInsets();
  const [mood, setMood] = useState<CheckInLevel | null>(null);
  const [stress, setStress] = useState<CheckInLevel | null>(null);
  const [note, setNote] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState(false);
  const [feedback, setFeedback] = useState<'saved' | 'updated' | 'deleted' | null>(null);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>(7);
  const [trend, setTrend] = useState<MoodTrend | null>(null);
  const [trendState, setTrendState] = useState<LoadState>('loading');
  const [trendRefreshing, setTrendRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MoodEntry | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const [editTarget, setEditTarget] = useState<MoodEntry | null>(null);
  const [editMood, setEditMood] = useState<CheckInLevel>(3);
  const [editStress, setEditStress] = useState<CheckInLevel>(3);
  const [editNote, setEditNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const requestVersion = useRef(0);
  const trendRequestVersion = useRef(0);

  const loadHistory = useCallback(async (refresh = false) => {
    const request = ++requestVersion.current;
    if (refresh) setRefreshing(true);
    else setLoadState('loading');
    if (!userId) { setLoadState('error'); setRefreshing(false); return; }
    try {
      const { data, error } = await supabase.from('mood_entries')
        .select('id,mood_level,stress_level,note,recorded_at')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(10);
      if (request !== requestVersion.current) return;
      if (error) throw error;
      setEntries((data ?? []) as MoodEntry[]);
      setLoadState('ready');
    } catch {
      if (request === requestVersion.current) { setEntries([]); setLoadState('error'); }
    } finally {
      if (request === requestVersion.current) setRefreshing(false);
    }
  }, [userId]);

  const loadTrends = useCallback(async (refresh = false) => {
    const request = ++trendRequestVersion.current;
    if (refresh) setTrendRefreshing(true);
    else setTrendState('loading');
    if (!userId) { setTrendState('error'); setTrendRefreshing(false); return; }
    const now = new Date();
    const bounds = moodPeriodBounds(trendPeriod, now);
    try {
      const rows: TrendEntry[] = [];
      for (let offset = 0; ; offset += TREND_PAGE_SIZE) {
        const { data, error } = await supabase.from('mood_entries')
          .select('mood_level,stress_level,recorded_at')
          .eq('user_id', userId)
          .gte('recorded_at', bounds.previousStart.toISOString())
          .lt('recorded_at', bounds.endExclusive.toISOString())
          .order('recorded_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + TREND_PAGE_SIZE - 1);
        if (request !== trendRequestVersion.current) return;
        if (error) throw error;
        const page = (data ?? []) as TrendEntry[];
        rows.push(...page);
        if (page.length < TREND_PAGE_SIZE) break;
      }
      setTrend(summarizeMoodTrend(rows, trendPeriod, now));
      setTrendState('ready');
    } catch {
      if (request === trendRequestVersion.current) { setTrend(null); setTrendState('error'); }
    } finally {
      if (request === trendRequestVersion.current) setTrendRefreshing(false);
    }
  }, [userId, trendPeriod]);

  useFocusEffect(useCallback(() => {
    void loadHistory();
    return () => { ++requestVersion.current; };
  }, [loadHistory]));

  useFocusEffect(useCallback(() => {
    void loadTrends();
    return () => { ++trendRequestVersion.current; };
  }, [loadTrends]));

  async function saveCheckIn() {
    if (saving) return;
    const errors: FormErrors = {
      mood: isCheckInLevel(mood) ? undefined : t('mind.moodRequired'),
      stress: isCheckInLevel(stress) ? undefined : t('mind.stressRequired'),
    };
    setFormErrors(errors);
    setSaveError(false);
    setFeedback(null);
    if (errors.mood || errors.stress) return;
    if (!userId) { setSaveError(true); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('mood_entries').insert({
        user_id: userId, mood_level: mood, stress_level: stress, note: note.trim() || null,
      }).select('id').single();
      if (error || !data) throw error ?? new Error('No check-in returned');
      setMood(null); setStress(null); setNote(''); setFormErrors({}); setFeedback('saved');
      await Promise.all([loadHistory(true), loadTrends(true)]);
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  async function deleteEntry() {
    if (!deleteTarget || !userId || deleting) return;
    setDeleting(true); setDeleteError(false);
    try {
      const { data, error } = await supabase.from('mood_entries').delete()
        .eq('id', deleteTarget.id).eq('user_id', userId).select('id').maybeSingle();
      if (error || !data) throw error ?? new Error('No check-in deleted');
      setDeleteTarget(null); setFeedback('deleted');
      await Promise.all([loadHistory(true), loadTrends(true)]);
    } catch { setDeleteError(true); }
    finally { setDeleting(false); }
  }

  function openEdit(entry: MoodEntry) {
    setEditTarget(entry);
    setEditMood(entry.mood_level);
    setEditStress(entry.stress_level);
    setEditNote(entry.note ?? '');
    setUpdateError(false);
  }

  async function updateEntry() {
    if (!editTarget || !userId || updating) return;
    setUpdating(true); setUpdateError(false);
    try {
      // Only the self-reported levels and note change; the recorded time and ownership stay as saved.
      const { data, error } = await supabase.from('mood_entries')
        .update({ mood_level: editMood, stress_level: editStress, note: editNote.trim() || null })
        .eq('id', editTarget.id).eq('user_id', userId).select('id').maybeSingle();
      if (error || !data) throw error ?? new Error('No check-in updated');
      setEditTarget(null); setFeedback('updated');
      await Promise.all([loadHistory(true), loadTrends(true)]);
    } catch { setUpdateError(true); }
    finally { setUpdating(false); }
  }

  const moodChoices = CHECK_IN_LEVELS.map((value, index) => ({ value, label: t(moodLabelKey(value)), icon: moodIcons[index] }));
  const stressChoices = CHECK_IN_LEVELS.map((value, index) => ({ value, label: t(stressLabelKey(value)), icon: stressIcons[index] }));

  return <>
    <FlatList
      style={{ backgroundColor: tokens.screenBackground }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space6 }]}
      keyboardShouldPersistTaps="handled"
      data={loadState === 'ready' ? entries : []}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing || trendRefreshing} onRefresh={() => { void Promise.all([loadHistory(true), loadTrends(true)]); }} tintColor={tokens.brandCyan} colors={[tokens.brandBlue]} />}
      ListHeaderComponent={<View>
        <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('mind.eyebrow')}</Text>
        <Text style={[styles.heading, { color: tokens.screenText }]}>{t('mind.heading')}</Text>
        <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('mind.helper')}</Text>
        <View style={styles.privacy}><Ionicons name="lock-closed-outline" size={17} color={tokens.pageAccent} /><Text style={[styles.privacyText, { color: tokens.mutedText }]}>{t('mind.privacy')}</Text></View>
        <View style={[styles.formCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('mind.checkIn')}</Text>
          <LevelChoices label={t('mind.mood')} choices={moodChoices} selected={mood} onSelect={(value) => { setMood(value); setFormErrors((current) => ({ ...current, mood: undefined })); }} error={formErrors.mood} disabled={saving} />
          <LevelChoices label={t('mind.stress')} choices={stressChoices} selected={stress} onSelect={(value) => { setStress(value); setFormErrors((current) => ({ ...current, stress: undefined })); }} error={formErrors.stress} disabled={saving} />
          <View style={styles.noteField}>
            <Text style={[styles.fieldLabel, { color: tokens.cardText }]}>{t('mind.note')}</Text>
            <TextInput accessibilityLabel={t('mind.note')} value={note} onChangeText={setNote} placeholder={t('mind.notePlaceholder')} placeholderTextColor={tokens.cardMutedText} selectionColor={tokens.brandCyan} multiline textAlignVertical="top" editable={!saving} style={[styles.noteInput, { backgroundColor: tokens.cardElevated, borderColor: tokens.border, color: tokens.cardText }]} />
          </View>
          {saveError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t(userId ? 'mind.saveError' : 'mind.sessionError')}</Text>}
          <PrimaryButton onPress={() => { void saveCheckIn(); }} loading={saving}>{t(saving ? 'mind.saving' : 'mind.save')}</PrimaryButton>
        </View>
        {feedback && <Text style={[styles.feedback, { color: tokens.successText }]} accessibilityRole="alert">{t(feedback === 'saved' ? 'mind.saved' : feedback === 'updated' ? 'mind.updated' : 'mind.deleted')}</Text>}
        <View style={styles.trendSection}><MoodTrendCard period={trendPeriod} onPeriodChange={setTrendPeriod} state={trendState} trend={trend} onRetry={() => { void loadTrends(); }} /></View>
        <View style={styles.forYouSection}><ForYouCard latest={loadState === 'ready' && entries[0]
          ? { mood_level: entries[0].mood_level, stress_level: entries[0].stress_level } : null} /></View>
        <Text style={[styles.historyHeading, { color: tokens.screenText }]}>{t('mind.recent')}</Text>
      </View>}
      ListEmptyComponent={loadState === 'loading'
        ? <View style={[styles.stateCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><ActivityIndicator size="large" color={tokens.brandCyan} /><Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('mind.loading')}</Text></View>
        : loadState === 'error'
          ? <View style={[styles.stateCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Text style={[styles.body, { color: tokens.cardText }]}>{t('mind.loadError')}</Text><PrimaryButton onPress={() => { void loadHistory(); }}>{t('mind.retry')}</PrimaryButton></View>
          : <View style={[styles.stateCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Ionicons name="heart-outline" size={28} color={tokens.brandCyan} /><Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('mind.emptyTitle')}</Text><Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('mind.emptyBody')}</Text></View>}
      renderItem={({ item }) => {
        const date = formatCheckInDate(item.recorded_at, language);
        return <View testID={`mind-entry-${item.id}`} style={[styles.entryCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <View style={styles.entryTop}><Text style={[styles.date, { color: tokens.cardMutedText }]}>{date}</Text><View style={styles.entryActions}><Pressable accessibilityRole="button" accessibilityLabel={t('mind.editEntry')} disabled={deleting || updating} onPress={() => openEdit(item)} style={styles.deleteIcon}><Ionicons name="create-outline" size={20} color={tokens.cardText} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t('mind.deleteEntry')} disabled={deleting} onPress={() => { setDeleteError(false); setDeleteTarget(item); }} style={styles.deleteIcon}><Ionicons name="trash-outline" size={20} color={tokens.cardErrorText} /></Pressable></View></View>
          <View style={styles.entryLevels}><Text style={[styles.levelText, { color: tokens.cardText }]}>{t('mind.mood')}: {t(moodLabelKey(item.mood_level))}</Text><Text style={[styles.levelText, { color: tokens.cardText }]}>{t('mind.stress')}: {t(stressLabelKey(item.stress_level))}</Text></View>
          {item.note && <Text style={[styles.entryNote, { color: tokens.cardMutedText }]}>{item.note}</Text>}
        </View>;
      }}
    />
    <Modal visible={!!editTarget} transparent animationType="slide" onRequestClose={() => { if (!updating) setEditTarget(null); }}>
      <View style={styles.sheetRoot}>
        <Pressable style={[styles.scrim, { backgroundColor: tokens.modalScrim }]} disabled={updating} onPress={() => setEditTarget(null)} accessibilityLabel={t('mind.cancel')} />
        <View testID="mind-edit-sheet" style={[styles.sheet, { backgroundColor: tokens.cardBackground, borderColor: tokens.border, paddingBottom: Math.max(insets.bottom, spacing.space4) }]} accessibilityViewIsModal>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
            <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('mind.editTitle')}</Text>
            {editTarget && <Text style={[styles.date, { color: tokens.cardMutedText }]}>{t('mind.editTime', { date: formatCheckInDate(editTarget.recorded_at, language) })}</Text>}
            <LevelChoices label={t('mind.mood')} choices={moodChoices} selected={editMood} onSelect={setEditMood} disabled={updating} />
            <LevelChoices label={t('mind.stress')} choices={stressChoices} selected={editStress} onSelect={setEditStress} disabled={updating} />
            <View style={styles.noteField}>
              <Text style={[styles.fieldLabel, { color: tokens.cardText }]}>{t('mind.note')}</Text>
              <TextInput accessibilityLabel={t('mind.note')} value={editNote} onChangeText={setEditNote} placeholder={t('mind.notePlaceholder')} placeholderTextColor={tokens.cardMutedText} selectionColor={tokens.brandCyan} multiline textAlignVertical="top" editable={!updating} style={[styles.noteInput, { backgroundColor: tokens.cardElevated, borderColor: tokens.border, color: tokens.cardText }]} />
            </View>
            {updateError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t('mind.updateError')}</Text>}
            <View style={styles.dialogActions}>
              <Pressable accessibilityRole="button" disabled={updating} onPress={() => setEditTarget(null)} style={[styles.dialogButton, { backgroundColor: tokens.cardElevated, borderColor: tokens.border, borderWidth: 1 }]}><Text style={[styles.dialogLabel, { color: tokens.cardText }]}>{t('mind.cancel')}</Text></Pressable>
              <View style={styles.saveAction}><PrimaryButton onPress={() => { void updateEntry(); }} loading={updating}>{t(updating ? 'mind.saving' : 'mind.saveChanges')}</PrimaryButton></View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
    <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => { if (!deleting) setDeleteTarget(null); }}>
      <View style={styles.modalRoot}>
        <Pressable style={[styles.scrim, { backgroundColor: tokens.modalScrim }]} disabled={deleting} onPress={() => setDeleteTarget(null)} accessibilityLabel={t('mind.cancel')} />
        <View style={[styles.dialog, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} accessibilityViewIsModal>
          <Text style={[styles.cardTitle, { color: tokens.cardText }]}>{t('mind.deleteConfirm')}</Text>
          <Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('mind.deleteBody')}</Text>
          {deleteError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t('mind.deleteError')}</Text>}
          <View style={styles.dialogActions}>
            <Pressable accessibilityRole="button" disabled={deleting} onPress={() => setDeleteTarget(null)} style={[styles.dialogButton, { backgroundColor: tokens.cardElevated, borderColor: tokens.border, borderWidth: 1 }]}><Text style={[styles.dialogLabel, { color: tokens.cardText }]}>{t('mind.cancel')}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: deleting, busy: deleting }} disabled={deleting} onPress={() => { void deleteEntry(); }} style={[styles.dialogButton, { backgroundColor: tokens.destructiveBackground }]}>{deleting ? <ActivityIndicator color={tokens.destructiveForeground} /> : <Text style={[styles.dialogLabel, { color: tokens.destructiveForeground }]}>{t('mind.delete')}</Text>}</Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.space6, paddingBottom: 112, width: '100%', maxWidth: 568, alignSelf: 'center' },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 }, heading: { ...typography.screenTitle, marginBottom: spacing.space2 }, helper: { ...typography.body, lineHeight: 23, marginBottom: spacing.space4 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, marginBottom: spacing.space6 }, privacyText: { ...typography.label, flex: 1 },
  formCard: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space5 }, cardTitle: { ...typography.sectionTitle },
  noteField: { gap: spacing.space2 }, fieldLabel: { ...typography.label }, noteInput: { ...typography.body, minHeight: 100, borderWidth: 1, borderRadius: radius.radiusMd, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3 },
  error: { ...typography.label }, feedback: { ...typography.label, marginTop: spacing.space4 }, trendSection: { marginTop: spacing.space6 }, forYouSection: { marginTop: spacing.space4 }, historyHeading: { ...typography.sectionTitle, marginTop: spacing.space8, marginBottom: spacing.space4 },
  stateCard: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space4, alignItems: 'flex-start' }, body: { ...typography.body, lineHeight: 23 },
  entryCard: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, marginBottom: spacing.space3, gap: spacing.space3 }, entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { ...typography.label }, entryActions: { flexDirection: 'row', alignItems: 'center' }, deleteIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, entryLevels: { gap: spacing.space2 }, levelText: { ...typography.body, fontWeight: '600' }, entryNote: { ...typography.body, lineHeight: 22 },
  modalRoot: { flex: 1, justifyContent: 'center', padding: spacing.space5 },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' }, sheet: { maxHeight: '88%', width: '100%', maxWidth: 568, alignSelf: 'center', borderWidth: 1, borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg, paddingHorizontal: spacing.space5, paddingTop: spacing.space5 },
  sheetContent: { gap: spacing.space4, paddingBottom: spacing.space2 }, saveAction: { flex: 1 }, scrim: { ...StyleSheet.absoluteFill }, dialog: { width: '100%', maxWidth: 420, alignSelf: 'center', borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space4 },
  dialogActions: { flexDirection: 'row', gap: spacing.space3 }, dialogButton: { flex: 1, minHeight: 50, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.space2 }, dialogLabel: { ...typography.body, fontWeight: '700' },
});
