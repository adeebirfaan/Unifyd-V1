import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { LevelChoices } from '@/components/mind/LevelChoices';
import { MOOD_ICONS, STRESS_ICONS } from '@/components/mind/levelIcons';
import { MoodTrendCard } from '@/components/mind/MoodTrendCard';
import { radius, spacing, typography } from '@/constants/theme';
import { CHECK_IN_LEVELS, formatCheckInDate, moodLabelKey, stressLabelKey } from '@/lib/moodEntries';
import type { CheckInLevel, MoodEntry } from '@/lib/moodEntries';
import { moodPeriodBounds, summarizeMoodTrend } from '@/lib/moodTrends';
import type { MoodTrend, TrendEntry, TrendPeriod } from '@/lib/moodTrends';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LoadState = 'loading' | 'ready' | 'error';
const TREND_PAGE_SIZE = 500;

/**
 * Mind History (2026-11-15, from the Mind History shortcut): the ten latest check-ins with edit and delete
 * (SRS-FR-605 to 607; behaviour unchanged from the old Mind list), and the 7- or 30-day trends, one at a time.
 */
export default function MoodHistoryScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'entries' | 'trends'>('entries');
  const [feedback, setFeedback] = useState<'updated' | 'deleted' | null>(null);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>(7);
  const [trend, setTrend] = useState<MoodTrend | null>(null);
  const [trendState, setTrendState] = useState<LoadState>('loading');
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

  const loadTrends = useCallback(async () => {
    const request = ++trendRequestVersion.current;
    setTrendState('loading');
    if (!userId) { setTrendState('error'); return; }
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

  async function deleteEntry() {
    if (!deleteTarget || !userId || deleting) return;
    setDeleting(true); setDeleteError(false);
    try {
      const { data, error } = await supabase.from('mood_entries').delete()
        .eq('id', deleteTarget.id).eq('user_id', userId).select('id').maybeSingle();
      if (error || !data) throw error ?? new Error('No check-in deleted');
      setDeleteTarget(null); setFeedback('deleted');
      await Promise.all([loadHistory(true), loadTrends()]);
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
      await Promise.all([loadHistory(true), loadTrends()]);
    } catch { setUpdateError(true); }
    finally { setUpdating(false); }
  }

  const moodChoices = CHECK_IN_LEVELS.map((value, index) => ({ value, label: t(moodLabelKey(value)), icon: MOOD_ICONS[index] }));
  const stressChoices = CHECK_IN_LEVELS.map((value, index) => ({ value, label: t(stressLabelKey(value)), icon: STRESS_ICONS[index] }));
  const stateCard = [styles.stateCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }];

  return <>
    <FlatList
      style={{ backgroundColor: tokens.screenBackground }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4 }]}
      data={view === 'entries' && loadState === 'ready' ? entries : []}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void Promise.all([loadHistory(true), loadTrends()]); }} tintColor={tokens.brandCyan} colors={[tokens.brandBlue]} />}
      ListHeaderComponent={<View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={tokens.screenText} />
        </Pressable>
        <Text accessibilityRole="header" style={[styles.heading, { color: tokens.screenText }]}>{t('mind.viewHistory')}</Text>
        {feedback && <Text style={[styles.feedback, { color: tokens.successText }]} accessibilityRole="alert">{t(feedback === 'updated' ? 'mind.updated' : 'mind.deleted')}</Text>}
        <View style={[styles.switcher, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} accessibilityRole="tablist">
          {(['entries', 'trends'] as const).map((option) => (
            <Pressable key={option} testID={`mind-view-${option}`} accessibilityRole="tab" accessibilityState={{ selected: view === option }} aria-selected={view === option} onPress={() => setView(option)}
              style={[styles.switchButton, view === option && { backgroundColor: tokens.cardElevated }]}>
              <Text style={[styles.switchText, { color: view === option ? tokens.brandCyan : tokens.cardMutedText }]}>{t(option === 'entries' ? 'mind.viewEntries' : 'mind.viewTrends')}</Text>
            </Pressable>
          ))}
        </View>
        {view === 'trends' && <MoodTrendCard period={trendPeriod} onPeriodChange={setTrendPeriod} state={trendState} trend={trend} onRetry={() => { void loadTrends(); }} />}
      </View>}
      ListEmptyComponent={view !== 'entries' ? undefined : loadState === 'loading'
        ? <View style={stateCard}><ActivityIndicator size="large" color={tokens.brandCyan} /><Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('mind.loading')}</Text></View>
        : loadState === 'error'
          ? <View style={stateCard}><Text style={[styles.body, { color: tokens.cardText }]}>{t('mind.loadError')}</Text><PrimaryButton onPress={() => { void loadHistory(); }}>{t('mind.retry')}</PrimaryButton></View>
          : <View style={stateCard}><Ionicons name="heart-outline" size={28} color={tokens.brandCyan} /><Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('mind.emptyTitle')}</Text></View>}
      renderItem={({ item }) => {
        const date = formatCheckInDate(item.recorded_at, language);
        return <View testID={`mind-entry-${item.id}`} style={[styles.entryCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <View style={styles.entryTop}><Text style={[styles.date, { color: tokens.cardMutedText }]}>{date}</Text><View style={styles.entryActions}><Pressable accessibilityRole="button" accessibilityLabel={t('mind.editEntry')} disabled={deleting || updating} onPress={() => openEdit(item)} style={styles.iconButton}><Ionicons name="create-outline" size={20} color={tokens.cardText} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t('mind.deleteEntry')} disabled={deleting} onPress={() => { setDeleteError(false); setDeleteTarget(item); }} style={styles.iconButton}><Ionicons name="trash-outline" size={20} color={tokens.cardErrorText} /></Pressable></View></View>
          <View style={styles.entryLevels}>
            <View style={[styles.levelChip, { backgroundColor: tokens.cardElevated }]}><Ionicons name={MOOD_ICONS[item.mood_level - 1]} size={16} color={tokens.brandCyan} /><Text style={[styles.levelText, { color: tokens.cardText }]}>{t('mind.mood')}: {t(moodLabelKey(item.mood_level))}</Text></View>
            <View style={[styles.levelChip, { backgroundColor: tokens.cardElevated }]}><Ionicons name={STRESS_ICONS[item.stress_level - 1]} size={16} color={tokens.cardMutedText} /><Text style={[styles.levelText, { color: tokens.cardText }]}>{t('mind.stress')}: {t(stressLabelKey(item.stress_level))}</Text></View>
          </View>
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
            <TextInput accessibilityLabel={t('mind.note')} value={editNote} onChangeText={setEditNote} placeholder={t('mind.notePlaceholder')} placeholderTextColor={tokens.cardMutedText} selectionColor={tokens.brandCyan} multiline textAlignVertical="top" editable={!updating} style={[styles.noteInput, { backgroundColor: tokens.cardElevated, borderColor: tokens.border, color: tokens.cardText }]} />
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
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.space3, marginBottom: spacing.space3 },
  heading: { ...typography.screenTitle }, feedback: { ...typography.label, marginTop: spacing.space3 },
  switcher: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.radiusFull, padding: spacing.space1, marginTop: spacing.space5, marginBottom: spacing.space4 },
  switchButton: { flex: 1, minHeight: 44, borderRadius: radius.radiusFull, alignItems: 'center', justifyContent: 'center' }, switchText: { ...typography.label, fontWeight: '700' },
  cardTitle: { ...typography.sectionTitle }, body: { ...typography.body, lineHeight: 23 }, error: { ...typography.label },
  stateCard: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space3, alignItems: 'flex-start' },
  entryCard: { borderWidth: 1, borderRadius: radius.radiusLg, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3, marginBottom: spacing.space3, gap: spacing.space2 },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { ...typography.label }, entryActions: { flexDirection: 'row', alignItems: 'center' }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  entryLevels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2 },
  levelChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.space1, borderRadius: radius.radiusFull, paddingHorizontal: spacing.space3, paddingVertical: spacing.space1 },
  levelText: { ...typography.label, fontWeight: '600' }, entryNote: { ...typography.body, lineHeight: 22 },
  noteInput: { ...typography.body, minHeight: 88, borderWidth: 1, borderRadius: radius.radiusMd, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3 },
  modalRoot: { flex: 1, justifyContent: 'center', padding: spacing.space5 },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' }, sheet: { maxHeight: '88%', width: '100%', maxWidth: 568, alignSelf: 'center', borderWidth: 1, borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg, paddingHorizontal: spacing.space5, paddingTop: spacing.space5 },
  sheetContent: { gap: spacing.space4, paddingBottom: spacing.space2 }, saveAction: { flex: 1 }, scrim: { ...StyleSheet.absoluteFill },
  dialog: { width: '100%', maxWidth: 420, alignSelf: 'center', borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space4 },
  dialogActions: { flexDirection: 'row', gap: spacing.space3 }, dialogButton: { flex: 1, minHeight: 50, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.space2 }, dialogLabel: { ...typography.body, fontWeight: '700' },
});
