import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconQuickActions } from '@/components/IconQuickActions';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { InsightDeck } from '@/components/home/InsightDeck';
import { AfterCheckInCard } from '@/components/mind/AfterCheckInCard';
import { LevelChoices } from '@/components/mind/LevelChoices';
import { MOOD_ICONS, STRESS_ICONS } from '@/components/mind/levelIcons';
import { DailyDeckCard, IdeasDeckCard, WeekDeckCard } from '@/components/mind/MindCards';
import type { TrendLoad } from '@/components/mind/MindCards';
import { radius, spacing, typography } from '@/constants/theme';
import { CHECK_IN_LEVELS, isCheckInLevel, moodLabelKey, stressLabelKey } from '@/lib/moodEntries';
import type { CheckInLevel } from '@/lib/moodEntries';
import { moodPeriodBounds, summarizeMoodTrend } from '@/lib/moodTrends';
import type { TrendEntry } from '@/lib/moodTrends';
import { supabase } from '@/lib/supabase';
import type { CheckInLevels } from '@/lib/wellbeing';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type FormErrors = { mood?: string; stress?: string };
const TREND_PAGE_SIZE = 500;
const WEEK = 7;

/**
 * Mind main page (2026-11-15 revamp, matching Wallet and Studies): a compact header, the Mind deck (This week on the
 * brand gradient, then Each day and Ideas), four icon shortcuts (Get help, Breathe, Reflect, History) that open their
 * own pages, and the mood and stress check-in in its own card for fast access. History, edit, delete, and the
 * 30-day view live on /mood-history.
 */
export default function MindScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [mood, setMood] = useState<CheckInLevel | null>(null);
  const [stress, setStress] = useState<CheckInLevel | null>(null);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [afterCheckIn, setAfterCheckIn] = useState<CheckInLevels | null>(null);
  const [week, setWeek] = useState<TrendLoad>({ state: 'loading' });
  const [latest, setLatest] = useState<TrendEntry | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef(0);

  // One query feeds the whole deck: this week plus the week before (for the comparison), newest first.
  const loadWeek = useCallback(async (pull = false) => {
    const current = ++request.current;
    if (pull) setRefreshing(true);
    else setWeek((previous) => previous.state === 'ready' ? previous : { state: 'loading' });
    if (!userId) { setWeek({ state: 'error' }); setRefreshing(false); return; }
    const now = new Date();
    const bounds = moodPeriodBounds(WEEK, now);
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
        if (current !== request.current) return;
        if (error) throw error;
        const page = (data ?? []) as TrendEntry[];
        rows.push(...page);
        if (page.length < TREND_PAGE_SIZE) break;
      }
      setWeek({ state: 'ready', trend: summarizeMoodTrend(rows, WEEK, now) });
      // The ideas follow the newest check-in in this window, chosen by time rather than by row order.
      setLatest(rows.reduce<TrendEntry | null>((newest, row) => !newest || row.recorded_at > newest.recorded_at ? row : newest, null));
    } catch {
      if (current === request.current) setWeek({ state: 'error' });
    } finally {
      if (current === request.current) setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void loadWeek();
    return () => { ++request.current; };
  }, [loadWeek]));

  async function saveCheckIn() {
    if (saving) return;
    const errors: FormErrors = {
      mood: isCheckInLevel(mood) ? undefined : t('mind.moodRequired'),
      stress: isCheckInLevel(stress) ? undefined : t('mind.stressRequired'),
    };
    setFormErrors(errors);
    setSaveError(false);
    setSaved(false);
    setAfterCheckIn(null);
    if (errors.mood || errors.stress) return;
    if (!userId) { setSaveError(true); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('mood_entries').insert({
        user_id: userId, mood_level: mood, stress_level: stress, note: note.trim() || null,
      }).select('id').single();
      if (error || !data) throw error ?? new Error('No check-in returned');
      setAfterCheckIn({ mood_level: mood as CheckInLevel, stress_level: stress as CheckInLevel });
      setMood(null); setStress(null); setNote(''); setNoteOpen(false); setFormErrors({}); setSaved(true);
      await loadWeek(true);
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  const moodChoices = CHECK_IN_LEVELS.map((value, index) => ({ value, label: t(moodLabelKey(value)), icon: MOOD_ICONS[index] }));
  const stressChoices = CHECK_IN_LEVELS.map((value, index) => ({ value, label: t(stressLabelKey(value)), icon: STRESS_ICONS[index] }));
  const retry = () => { void loadWeek(); };

  return (
    <ScrollView style={{ backgroundColor: tokens.screenBackground }} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4 }]} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadWeek(true); }} tintColor={tokens.brandCyan} colors={[tokens.brandBlue]} />}>
      {/* 1. Compact header. */}
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('mind.eyebrow')}</Text>
      <Text accessibilityRole="header" style={[styles.heading, { color: tokens.screenText }]}>{t('mind.heading')}</Text>

      {/* 2. Mind deck, as Wallet's and Studies' decks: This week on the brand gradient, then Each day and Ideas. */}
      <InsightDeck testID="mind-deck" hint={t('mind.deckHint')}
        dotLabel={(item, position, total) => t('mind.deckDot', { name: item.name, position: position + 1, total })}
        cards={[
          { key: 'week', name: t('mind.cardWeek'), surface: 'hero', render: () => <WeekDeckCard load={week} onRetry={retry} /> },
          { key: 'daily', name: t('mind.cardDaily'), surface: 'plain', render: () => <DailyDeckCard load={week} onRetry={retry} /> },
          { key: 'ideas', name: t('mind.forYou'), surface: 'plain', render: () => <IdeasDeckCard latest={latest} /> },
        ]} />

      {/* 3. Icon shortcuts, each opening its own page. Get help is the filled one, so help is always easy to find (SRS-FR-1101). */}
      <View testID="mind-quick-actions"><IconQuickActions testIDPrefix="mind" actions={[
        { key: 'get-help', icon: 'help-buoy-outline', label: t('wellbeing.tile.help'), a11y: t('wellbeing.getHelp'), onPress: () => router.push('/get-help'), primary: true },
        { key: 'breathing', icon: 'leaf-outline', label: t('wellbeing.tile.breathe'), a11y: t('wellbeing.breathe.title'), onPress: () => router.push('/breathing') },
        { key: 'reflect', icon: 'chatbubbles-outline', label: t('wellbeing.tile.reflect'), a11y: t('wellbeing.reflect.title'), onPress: () => router.push('/how-have-you-been') },
        { key: 'history', icon: 'time-outline', label: t('mind.viewHistory'), a11y: t('mind.viewHistory'), onPress: () => router.push('/mood-history') },
      ]} /></View>

      {/* 4. The check-in, on its own for fast access (SRS-FR-601 to 604). */}
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: tokens.screenText }]}>{t('mind.checkInTitle')}</Text>
      <View testID="mind-checkin" style={[styles.formCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <LevelChoices label={t('mind.mood')} choices={moodChoices} selected={mood} onSelect={(value) => { setMood(value); setFormErrors((current) => ({ ...current, mood: undefined })); }} error={formErrors.mood} disabled={saving} />
        <LevelChoices label={t('mind.stress')} choices={stressChoices} selected={stress} onSelect={(value) => { setStress(value); setFormErrors((current) => ({ ...current, stress: undefined })); }} error={formErrors.stress} disabled={saving} />
        {noteOpen || note
          ? <TextInput accessibilityLabel={t('mind.note')} value={note} onChangeText={setNote} placeholder={t('mind.notePlaceholder')} placeholderTextColor={tokens.cardMutedText} selectionColor={tokens.brandCyan} multiline textAlignVertical="top" editable={!saving} autoFocus={noteOpen && !note} style={[styles.noteInput, { backgroundColor: tokens.cardElevated, borderColor: tokens.border, color: tokens.cardText }]} />
          : <Pressable testID="mind-add-note" accessibilityRole="button" onPress={() => setNoteOpen(true)} disabled={saving} style={({ pressed }) => [styles.addNote, pressed && styles.pressed]}>
              <Ionicons name="add" size={18} color={tokens.brandCyan} /><Text style={[styles.addNoteText, { color: tokens.brandCyan }]}>{t('mind.addNote')}</Text>
            </Pressable>}
        {saveError && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t(userId ? 'mind.saveError' : 'mind.sessionError')}</Text>}
        <PrimaryButton onPress={() => { void saveCheckIn(); }} loading={saving}>{t(saving ? 'mind.saving' : 'mind.save')}</PrimaryButton>
        <View style={styles.privacy}><Ionicons name="lock-closed-outline" size={14} color={tokens.cardMutedText} /><Text style={[styles.privacyText, { color: tokens.cardMutedText }]}>{t('mind.private')}</Text></View>
      </View>
      {saved && <Text style={[styles.feedback, { color: tokens.successText }]} accessibilityRole="alert">{t('mind.saved')}</Text>}
      {afterCheckIn && <AfterCheckInCard levels={afterCheckIn} onDismiss={() => setAfterCheckIn(null)} onBreathe={() => { setAfterCheckIn(null); router.push('/breathing'); }} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.space6, paddingBottom: 112, gap: spacing.space3, width: '100%', maxWidth: 568, alignSelf: 'center' },
  eyebrow: { ...typography.label, letterSpacing: 2 }, heading: { ...typography.screenTitle, marginBottom: spacing.space2 },
  sectionTitle: { ...typography.sectionTitle, marginTop: spacing.space3 },
  formCard: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space5 },
  noteInput: { ...typography.body, minHeight: 88, borderWidth: 1, borderRadius: radius.radiusMd, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3 },
  addNote: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space1, alignSelf: 'flex-start' }, addNoteText: { ...typography.label, fontWeight: '700' },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space1, marginTop: -spacing.space2 }, privacyText: { ...typography.label },
  error: { ...typography.label }, feedback: { ...typography.label }, pressed: { opacity: 0.7 },
});
