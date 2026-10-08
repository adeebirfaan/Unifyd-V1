import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { DashboardPanel, PanelNote, StatRow } from '@/components/home/DashboardPanel';
import { Screen } from '@/components/Screen';
import { DEFAULT_AVATAR_ID } from '@/constants/avatars';
import type { TranslationKey } from '@/constants/i18n';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { formatPercentage } from '@/lib/budgetSummary';
import { loadDashboardFacts } from '@/lib/dashboardData';
import type { DashboardFacts, Direction } from '@/lib/dashboardFacts';
import { formatRinggit } from '@/lib/expenseHistory';
import { requestInsightSummary } from '@/lib/insights';
import type { InsightResult } from '@/lib/insights';
import { formatTaskDeadline } from '@/lib/tasks';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

// Facts reload on every visit; the AI summary is requested at most this often unless the student refreshes.
const SUMMARY_STALE_MS = 5 * 60 * 1000;
type FactsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; facts: DashboardFacts };
type SummaryState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; result: InsightResult };

const directionKey: Record<Direction, TranslationKey> = { higher: 'home.higher', lower: 'home.lower', similar: 'home.similar' };

export default function HomeScreen() {
  const { profile, session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || t('home.there');
  const [factsState, setFactsState] = useState<FactsState>({ status: 'loading' });
  const [summaryState, setSummaryState] = useState<SummaryState>({ status: 'idle' });
  const [refreshing, setRefreshing] = useState(false);
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

  useFocusEffect(useCallback(() => {
    void loadFacts();
    void loadSummary();
  }, [loadFacts, loadSummary]));

  async function refresh() {
    setRefreshing(true);
    await Promise.all([loadFacts(true), loadSummary(true)]);
    setRefreshing(false);
  }

  const facts = factsState.status === 'ready' ? factsState.facts : null;
  const finance = facts?.finance;
  const academic = facts?.academic;
  const wellness = facts?.wellness;
  const ringgit = (cents: number) => formatRinggit(cents / 100);
  const outOfFive = (value: number) => t('home.outOfFive', { value: value.toFixed(1) });
  const open = (path: '/(tabs)/wallet' | '/(tabs)/planner' | '/(tabs)/mind') => router.navigate(path);

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={tokens.brandCyan} colors={[tokens.brandBlue]} />}>
      <View style={styles.brandRow}>
        <Image source={require('../../assets/brand/unifyd-logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="Unifyd logo" />
        <Text style={[styles.brandName, { color: tokens.screenText }]}>unifyd</Text>
      </View>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('home.space')}</Text>
      <View style={styles.greetingRow}>
        <Text style={[styles.greeting, { color: tokens.screenText }]}>{t('home.greeting', { name: firstName })}</Text>
        <View style={styles.avatarFrame}>
          <Avatar id={profile?.avatar_id ?? DEFAULT_AVATAR_ID} size={52} />
          <View pointerEvents="none" style={[styles.avatarOutline, { borderColor: tokens.homeAvatarOutline }]} />
        </View>
      </View>
      <Text style={[styles.intro, { color: tokens.mutedText }]}>{t('home.intro')}</Text>

      {factsState.status === 'loading' && <View style={[styles.stateCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.stateText, { color: tokens.cardMutedText }]}>{t('home.loading')}</Text>
      </View>}
      {factsState.status === 'error' && <View style={[styles.stateCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <Text style={[styles.stateText, { color: tokens.cardText }]} accessibilityRole="alert">{t('home.loadError')}</Text>
        <PrimaryButton onPress={() => { void loadFacts(); }}>{t('home.retry')}</PrimaryButton>
      </View>}

      {finance && academic && wellness && <>
        <LinearGradient colors={colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroLabel}>{t('home.overview')}</Text>
          <View>
            <Text style={styles.heroCaption}>{t('home.monthSpent')}</Text>
            <Text style={styles.heroAmount}>{ringgit(finance.spentCents)}</Text>
            <Text style={styles.heroLine}>{finance.remainingCents === null ? t('home.noBudget')
              : finance.remainingCents >= 0 ? t('home.budgetLeft', { amount: ringgit(finance.remainingCents), budget: ringgit(finance.budgetCents ?? 0) })
                : t('home.budgetOver', { amount: ringgit(-finance.remainingCents), budget: ringgit(finance.budgetCents ?? 0) })}</Text>
          </View>
          <View style={styles.heroSplit}>
            <View style={styles.heroCell}>
              <Text style={styles.heroCaption}>{t('home.nextDeadline')}</Text>
              <Text style={styles.heroLine} numberOfLines={2}>{academic.nextDeadline ? academic.nextDeadline.title : t('home.noDeadline')}</Text>
              {academic.nextDeadline && <Text style={styles.heroSmall}>{formatTaskDeadline(academic.nextDeadline.deadline, language)}</Text>}
            </View>
            <View style={styles.heroCell}>
              <Text style={styles.heroCaption}>{t('home.moodWeek')}</Text>
              <Text style={styles.heroLine}>{wellness.averageMood === null ? t('home.noCheckIns') : outOfFive(wellness.averageMood)}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.panels}>
          <DashboardPanel title={t('home.panelMoney')} icon="wallet-outline" accessibilityLabel={t('home.openPanel', { name: t('tab.wallet') })} onPress={() => open('/(tabs)/wallet')}>
            {finance.expenseCount === 0 ? <PanelNote>{t('home.noExpenses')}</PanelNote> : <>
              <StatRow label={t('home.expenseCount')} value={String(finance.expenseCount)} />
              {finance.percentUsed !== null && <StatRow label={t('home.budgetUsed')} value={formatPercentage(finance.percentUsed)} tone={finance.remainingCents !== null && finance.remainingCents < 0 ? 'danger' : 'normal'} />}
              <StatRow label={t('home.topCategories')} value={finance.topCategories.map(({ category, percent }) => `${t(`expense.category.${category}`)} ${formatPercentage(percent)}`).join(' · ')} />
            </>}
          </DashboardPanel>

          <DashboardPanel title={t('home.panelStudies')} icon="calendar-outline" accessibilityLabel={t('home.openPanel', { name: t('tab.planner') })} onPress={() => open('/(tabs)/planner')}>
            {academic.pending + academic.ongoing === 0 ? <PanelNote>{t('home.noTasks')}</PanelNote> : <>
              <StatRow label={t('home.pending')} value={String(academic.pending)} />
              <StatRow label={t('home.ongoing')} value={String(academic.ongoing)} />
              <StatRow label={t('home.overdue')} value={String(academic.overdue)} tone={academic.overdue > 0 ? 'danger' : 'normal'} />
              <StatRow label={t('home.dueSoon')} value={String(academic.dueSoon)} />
            </>}
            <StatRow label={t('home.completedRecently')} value={String(academic.completedRecently)} />
          </DashboardPanel>

          <DashboardPanel title={t('home.panelWellbeing')} icon="heart-outline" accessibilityLabel={t('home.openPanel', { name: t('tab.mind') })} onPress={() => open('/(tabs)/mind')}>
            {wellness.checkIns === 0 ? <PanelNote>{t('home.noMoodData')}</PanelNote> : <>
              <StatRow label={t('home.checkIns')} value={String(wellness.checkIns)} />
              {wellness.averageMood !== null && <StatRow label={t('home.avgMood')} value={outOfFive(wellness.averageMood)} />}
              {wellness.averageStress !== null && <StatRow label={t('home.avgStress')} value={outOfFive(wellness.averageStress)} />}
              {wellness.moodVsPrevious && wellness.stressVsPrevious && <PanelNote>{t('home.vsPrevious', { mood: t(directionKey[wellness.moodVsPrevious]), stress: t(directionKey[wellness.stressVsPrevious]) })}</PanelNote>}
            </>}
            {wellness.repeatedLowMood && <View style={styles.notice} accessibilityRole="text">
              <Ionicons name="leaf-outline" size={18} color={colors.warning} />
              <View style={styles.noticeCopy}><PanelNote tone="warning">{t('home.lowMoodNotice')}</PanelNote><PanelNote>{t('home.notAdvice')}</PanelNote></View>
            </View>}
          </DashboardPanel>
        </View>
      </>}

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, marginBottom: spacing.space8 },
  logo: { width: 38, height: 38, borderRadius: 9 },
  brandName: { ...typography.sectionTitle, color: colors.textPrimary, letterSpacing: -0.5 },
  eyebrow: { ...typography.label, color: colors.brandCyan, letterSpacing: 2, marginBottom: spacing.space2 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  avatarFrame: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
  avatarOutline: { ...StyleSheet.absoluteFill, borderRadius: 26, borderWidth: 1.5 },
  greeting: { ...typography.display, color: colors.textPrimary, lineHeight: 38, flex: 1 },
  intro: { ...typography.body, color: colors.textSecondary, marginTop: spacing.space2, marginBottom: spacing.space6 },
  stateCard: { borderRadius: radius.radiusLg, borderWidth: 1, padding: spacing.space5, gap: spacing.space4, alignItems: 'stretch' },
  stateText: { ...typography.body, lineHeight: 22, textAlign: 'center' },
  hero: { borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space5 },
  heroLabel: { ...typography.label, color: colors.white, letterSpacing: 1.5, opacity: 0.85 },
  heroCaption: { ...typography.label, color: colors.white, opacity: 0.85 },
  heroAmount: { fontSize: 32, fontWeight: '700', color: colors.white, marginTop: spacing.space1, fontVariant: ['tabular-nums'] },
  heroLine: { ...typography.body, color: colors.white, fontWeight: '600', marginTop: spacing.space1 },
  heroSmall: { ...typography.label, color: colors.white, opacity: 0.85, marginTop: spacing.space1 },
  heroSplit: { flexDirection: 'row', gap: spacing.space4, flexWrap: 'wrap' },
  heroCell: { flex: 1, minWidth: 130 },
  panels: { gap: spacing.space3, marginTop: spacing.space5 },
  notice: { flexDirection: 'row', gap: spacing.space2, alignItems: 'flex-start', marginTop: spacing.space1 },
  noticeCopy: { flex: 1, gap: spacing.space1 },
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
