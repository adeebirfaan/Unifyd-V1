import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { CardDeck } from '@/components/home/CardDeck';
import { MoneyCard, OverviewCard, StudiesCard, WellbeingCard } from '@/components/home/DeckCards';
import { ShadePicker } from '@/components/home/ShadePicker';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { CARD_SHADES, DEFAULT_CARD_SHADES, cardShadesStorageKey, parseCardShades } from '@/lib/cardShades';
import type { CardShade, CardShadeChoice, ModuleCardKey } from '@/lib/cardShades';
import { loadDashboardFacts } from '@/lib/dashboardData';
import { greetingKey } from '@/lib/greeting';
import type { DashboardFacts } from '@/lib/dashboardFacts';
import { requestInsightSummary } from '@/lib/insights';
import type { InsightResult } from '@/lib/insights';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

// Facts reload on every visit; the AI summary is requested at most this often unless the student refreshes.
const SUMMARY_STALE_MS = 5 * 60 * 1000;
type FactsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; facts: DashboardFacts };
type SummaryState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; result: InsightResult };

export default function HomeScreen() {
  const { profile, session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || t('home.there');
  const [factsState, setFactsState] = useState<FactsState>({ status: 'loading' });
  const [summaryState, setSummaryState] = useState<SummaryState>({ status: 'idle' });
  const [refreshing, setRefreshing] = useState(false);
  // Module card colours are a per-account, on-device choice; defaults apply until changed.
  const [shades, setShades] = useState<CardShadeChoice>({ ...DEFAULT_CARD_SHADES });
  const [picking, setPicking] = useState<ModuleCardKey | null>(null);
  // Re-read on each visit so the greeting stays right if the app stays open across periods.
  const [hour, setHour] = useState(() => new Date().getHours());
  const factsRequest = useRef(0);
  const summaryRequest = useRef(0);
  const summaryAt = useRef<{ at: number; language: string } | null>(null);

  const loadFacts = useCallback(async (pull = false) => {
    if (!userId) return;
    const request = ++factsRequest.current;
    if (!pull) setFactsState((current) => current.status === 'ready' ? current : { status: 'loading' });
    try {
      const facts = await loadDashboardFacts(userId);
      if (request === factsRequest.current) setFactsState({ status: 'ready', facts });
    } catch {
      if (request === factsRequest.current) setFactsState({ status: 'error' });
    }
  }, [userId]);

  const loadSummary = useCallback(async (force = false) => {
    if (!userId) return;
    const last = summaryAt.current;
    if (!force && last && last.language === language && Date.now() - last.at < SUMMARY_STALE_MS) return;
    const request = ++summaryRequest.current;
    summaryAt.current = { at: Date.now(), language };
    setSummaryState({ status: 'loading' });
    const result = await requestInsightSummary(language);
    if (request === summaryRequest.current) setSummaryState({ status: 'done', result });
  }, [userId, language]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    AsyncStorage.getItem(cardShadesStorageKey(userId))
      .then((raw) => { if (active) setShades(parseCardShades(raw)); })
      .catch(() => { if (active) setShades({ ...DEFAULT_CARD_SHADES }); });
    return () => { active = false; };
  }, [userId]);

  function chooseShade(card: ModuleCardKey, shade: CardShade) {
    const next = { ...shades, [card]: shade };
    setShades(next);
    // A storage failure keeps the colour for this session rather than blocking the student.
    if (userId) AsyncStorage.setItem(cardShadesStorageKey(userId), JSON.stringify(next)).catch(() => undefined);
  }

  useFocusEffect(useCallback(() => {
    setHour(new Date().getHours());
    void loadFacts();
    void loadSummary();
  }, [loadFacts, loadSummary]));

  async function refresh() {
    setRefreshing(true);
    await Promise.all([loadFacts(true), loadSummary(true)]);
    setRefreshing(false);
  }

  const facts = factsState.status === 'ready' ? factsState.facts : null;
  const open = (path: '/(tabs)/wallet' | '/(tabs)/planner' | '/(tabs)/mind') => router.navigate(path);

  return (
    <Screen compact refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={tokens.brandCyan} colors={[tokens.brandBlue]} />}>
      <View style={styles.brandRow}>
        <Image source={require('../../assets/brand/unifyd-logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="Unifyd logo" />
        <Text style={[styles.brandName, { color: tokens.screenText }]}>unifyd.</Text>
      </View>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('home.space')}</Text>
      <View style={styles.greetingRow}>
        <Text style={[styles.greeting, { color: tokens.screenText }]}>{t(greetingKey(hour, language), { name: firstName })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('home.openProfile')} onPress={() => router.navigate('/(tabs)/profile')} style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
          <View style={styles.avatarFrame}>
            <Avatar id={profile?.avatar_id} size={58} />
            <View pointerEvents="none" style={[styles.avatarOutline, { borderColor: tokens.homeAvatarOutline }]} />
          </View>
          <View style={[styles.avatarBadge, { backgroundColor: tokens.cardBackground, borderColor: tokens.screenBackground }]}>
            <Ionicons name="settings-outline" size={12} color={tokens.cardText} />
          </View>
        </Pressable>
      </View>
      <Text style={[styles.intro, { color: tokens.mutedText }]}>{t('home.intro')}</Text>

      {factsState.status === 'loading' && <View style={[styles.stateCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.stateText, { color: tokens.cardMutedText }]}>{t('home.loading')}</Text>
      </View>}
      {factsState.status === 'error' && <View style={[styles.stateCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <Text style={[styles.stateText, { color: tokens.cardText }]} accessibilityRole="alert">{t('home.loadError')}</Text>
        <PrimaryButton onPress={() => { void loadFacts(); }}>{t('home.retry')}</PrimaryButton>
      </View>}

      {facts && <CardDeck cards={[
        { key: 'overview', name: t('home.cardOverview'), render: () => <OverviewCard facts={facts} /> },
        { key: 'money', name: t('home.panelMoney'), render: ({ goTo }) => <MoneyCard facts={facts} shade={CARD_SHADES[shades.money]} onCustomise={() => setPicking('money')} onOverview={() => goTo(0)} onOpen={() => open('/(tabs)/wallet')} /> },
        { key: 'studies', name: t('home.panelStudies'), render: ({ goTo }) => <StudiesCard facts={facts} shade={CARD_SHADES[shades.studies]} onCustomise={() => setPicking('studies')} onOverview={() => goTo(0)} onOpen={() => open('/(tabs)/planner')} /> },
        { key: 'wellbeing', name: t('home.panelWellbeing'), render: ({ goTo }) => <WellbeingCard facts={facts} shade={CARD_SHADES[shades.wellbeing]} onCustomise={() => setPicking('wellbeing')} onOverview={() => goTo(0)} onOpen={() => open('/(tabs)/mind')} /> },
      ]} />}

      <View style={[styles.aiCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <View style={styles.aiHeader}>
          <Ionicons name="sparkles-outline" size={20} color={tokens.brandCyan} />
          <Text style={[styles.aiTitle, { color: tokens.cardText }]}>{t('home.aiTitle')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('home.aiRefresh')} disabled={summaryState.status === 'loading'} onPress={() => { void loadSummary(true); }} style={styles.iconButton}>
            <Ionicons name="refresh" size={20} color={tokens.cardMutedText} />
          </Pressable>
        </View>
        {summaryState.status !== 'done' ? <View style={styles.aiLoading}><ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.stateText, { color: tokens.cardMutedText }]}>{t('home.aiLoading')}</Text></View>
          : summaryState.result.source === 'ai' ? <>
            {([['home.panelMoney', summaryState.result.summary.finance], ['home.panelStudies', summaryState.result.summary.academic], ['home.panelWellbeing', summaryState.result.summary.wellness]] as const).map(([label, text]) => (
              <View key={label} style={styles.aiSection}>
                <Text style={[styles.aiSectionLabel, { color: tokens.brandCyan }]}>{t(label)}</Text>
                <Text style={[styles.aiText, { color: tokens.cardText }]}>{text}</Text>
              </View>
            ))}
            <Text style={[styles.aiDisclaimer, { color: tokens.cardMutedText }]}>{t('home.aiLabel')}</Text>
          </> : <Text style={[styles.aiText, { color: tokens.cardMutedText }]}>{t('home.aiFallback')}</Text>}
      </View>
      <ShadePicker cardName={picking ? t(picking === 'money' ? 'home.panelMoney' : picking === 'studies' ? 'home.panelStudies' : 'home.panelWellbeing') : null}
        value={picking ? shades[picking] : DEFAULT_CARD_SHADES.money} onChange={(shade) => { if (picking) chooseShade(picking, shade); }} onClose={() => setPicking(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, marginBottom: spacing.space3 },
  logo: { width: 30, height: 30, borderRadius: 7 },
  brandName: { ...typography.sectionTitle, color: colors.textPrimary, letterSpacing: -0.5 },
  eyebrow: { ...typography.label, color: colors.brandCyan, letterSpacing: 2, marginBottom: spacing.space1 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  avatarButton: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: 0.8 },
  avatarFrame: { width: 58, height: 58, borderRadius: 29, overflow: 'hidden' },
  avatarBadge: { position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarOutline: { ...StyleSheet.absoluteFill, borderRadius: 29, borderWidth: 1.5 },
  greeting: { ...typography.display, fontSize: 28, color: colors.textPrimary, lineHeight: 34, flex: 1 },
  intro: { ...typography.body, color: colors.textSecondary, marginTop: spacing.space1, marginBottom: spacing.space3 },
  stateCard: { borderRadius: radius.radiusLg, borderWidth: 1, padding: spacing.space5, gap: spacing.space4, alignItems: 'stretch' },
  stateText: { ...typography.body, lineHeight: 22, textAlign: 'center' },
  aiCard: { borderRadius: radius.radiusMd, borderWidth: 1, padding: spacing.space4, gap: spacing.space3, marginTop: spacing.space5 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  aiTitle: { ...typography.sectionTitle, flex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  aiLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  aiSection: { gap: spacing.space1 },
  aiSectionLabel: { ...typography.label },
  aiText: { ...typography.body, lineHeight: 22 },
  aiDisclaimer: { ...typography.label, lineHeight: 18 },
});
