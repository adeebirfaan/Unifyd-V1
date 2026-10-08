import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TranslationKey } from '@/constants/i18n';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { formatPercentage } from '@/lib/budgetSummary';
import type { DashboardFacts, Direction } from '@/lib/dashboardFacts';
import { formatRinggit } from '@/lib/expenseHistory';
import { formatTaskDeadline } from '@/lib/tasks';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];
const ringgit = (cents: number) => formatRinggit(cents / 100);
const directionKey: Record<Direction, TranslationKey> = { higher: 'home.higher', lower: 'home.lower', similar: 'home.similar' };

function useFormat() {
  const { language, t } = useI18n();
  return { language, t, outOfFive: (value: number) => t('home.outOfFive', { value: value.toFixed(1) }) };
}

/** The Overview card keeps the Unifyd gradient so it is always the most prominent. */
export function OverviewCard({ facts }: { facts: DashboardFacts }) {
  const { language, t, outOfFive } = useFormat();
  const { finance, academic, wellness } = facts;
  const used = finance.budgetCents ? Math.min(1, finance.spentCents / finance.budgetCents) : null;
  return (
    <LinearGradient colors={colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
      <View style={styles.cardBody}>
        <Text style={styles.overviewLabel}>{t('home.overview')}</Text>
        <View>
          <Text style={styles.overviewCaption}>{t('home.monthSpent')}</Text>
          <Text style={styles.overviewAmount}>{ringgit(finance.spentCents)}</Text>
          <Text style={styles.overviewLine}>{finance.remainingCents === null ? t('home.noBudget')
            : finance.remainingCents >= 0 ? t('home.budgetLeft', { amount: ringgit(finance.remainingCents), budget: ringgit(finance.budgetCents ?? 0) })
              : t('home.budgetOver', { amount: ringgit(-finance.remainingCents), budget: ringgit(finance.budgetCents ?? 0) })}</Text>
          {used !== null && <View style={[styles.track, styles.overviewTrack]}><View style={[styles.bar, { width: `${used * 100}%`, backgroundColor: colors.white }]} /></View>}
        </View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewSplit}>
          <View style={styles.flex}>
            <Text style={styles.overviewCaption}>{t('home.nextDeadline')}</Text>
            <Text style={styles.overviewLine} numberOfLines={2}>{academic.nextDeadline ? academic.nextDeadline.title : t('home.noDeadline')}</Text>
            {academic.nextDeadline && <Text style={styles.overviewSmall}>{formatTaskDeadline(academic.nextDeadline.deadline, language)}</Text>}
          </View>
          <View style={styles.flex}>
            <Text style={styles.overviewCaption}>{t('home.moodWeek')}</Text>
            <Text style={styles.overviewLine}>{wellness.averageMood === null ? t('home.noCheckIns') : outOfFive(wellness.averageMood)}</Text>
          </View>
        </View>
        <View style={styles.chips}>
          {([['home.dueSoon', academic.dueSoon], ['home.overdue', academic.overdue], ['home.checkIns', wellness.checkIns]] as const).map(([label, value]) => (
            <View key={label} style={styles.chip}>
              <Text style={styles.chipValue}>{value}</Text>
              <Text style={styles.chipLabel} numberOfLines={2}>{t(label)}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.swipeHint}>
        <Ionicons name="swap-horizontal" size={16} color={colors.white} />
        <Text style={styles.overviewSmall}>{t('home.swipeHint')}</Text>
      </View>
    </LinearGradient>
  );
}

/** Shared frame for the dark module cards: title, a way back to Overview, and an Open action. */
function ModuleCard({ title, icon, shade, onOverview, openLabel, onOpen, children }: {
  title: string; icon: IconName; shade: string; onOverview: () => void; openLabel: string; onOpen: () => void; children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <View style={[styles.fill, styles.moduleCard, { backgroundColor: shade }]}>
      <View style={styles.header}>
        <View style={styles.iconWrap}><Ionicons name={icon} size={20} color={colors.brandCyan} /></View>
        <Text style={styles.title}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('home.backToOverview')} onPress={onOverview} style={({ pressed }) => [styles.overviewButton, pressed && styles.pressed]}>
          <Ionicons name="grid-outline" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.moduleBody}>{children}</View>
      <Pressable accessibilityRole="button" accessibilityLabel={openLabel} onPress={onOpen} style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}>
        <Text style={styles.openText}>{openLabel}</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

function Tile({ label, value, tone = 'normal', third = false }: { label: string; value: string; tone?: 'normal' | 'danger'; third?: boolean }) {
  return (
    <View style={[styles.tile, third && styles.tileThird]}>
      <Text style={[styles.tileValue, tone === 'danger' && styles.danger]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const Note = ({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warning' }) =>
  <Text style={[styles.note, tone === 'warning' && { color: colors.warning }]}>{children}</Text>;

type ModuleProps = { facts: DashboardFacts; shade: string; onOverview: () => void; onOpen: () => void };

export function MoneyCard({ facts, shade, onOverview, onOpen }: ModuleProps) {
  const { t } = useFormat();
  const { finance } = facts;
  const over = finance.remainingCents !== null && finance.remainingCents < 0;
  const used = finance.budgetCents ? Math.min(1, finance.spentCents / finance.budgetCents) : null;
  return (
    <ModuleCard title={t('home.panelMoney')} icon="wallet-outline" shade={shade} onOverview={onOverview} openLabel={t('home.openPanel', { name: t('tab.wallet') })} onOpen={onOpen}>
      <View>
        <Text style={styles.caption}>{t('home.monthSpent')}</Text>
        <Text style={styles.amount}>{ringgit(finance.spentCents)}</Text>
        <Text style={[styles.line, over && styles.danger]}>{finance.remainingCents === null ? t('home.noBudget')
          : !over ? t('home.budgetLeft', { amount: ringgit(finance.remainingCents ?? 0), budget: ringgit(finance.budgetCents ?? 0) })
            : t('home.budgetOver', { amount: ringgit(-(finance.remainingCents ?? 0)), budget: ringgit(finance.budgetCents ?? 0) })}</Text>
        {used !== null && <View style={styles.track}><View style={[styles.bar, { width: `${used * 100}%`, backgroundColor: over ? colors.danger : colors.brandCyan }]} /></View>}
      </View>
      {finance.expenseCount === 0 ? <Note>{t('home.noExpenses')}</Note> : <>
        <View style={styles.tiles}>
          <Tile label={t('home.expenseCount')} value={String(finance.expenseCount)} />
          {finance.percentUsed !== null && <Tile label={t('home.budgetUsed')} value={formatPercentage(finance.percentUsed)} tone={over ? 'danger' : 'normal'} />}
        </View>
        <View style={styles.rows}>
          <Text style={styles.caption}>{t('home.topCategories')}</Text>
          {finance.topCategories.map(({ category, percent }) => (
            <View key={category} style={styles.categoryRow}>
              <Text style={[styles.rowLabel, styles.categoryLabel]} numberOfLines={1}>{t(`expense.category.${category}`)}</Text>
              <View style={[styles.track, styles.categoryTrack]}><View style={[styles.bar, { width: `${percent}%`, backgroundColor: colors.brandCyan }]} /></View>
              <Text style={styles.rowValue}>{formatPercentage(percent)}</Text>
            </View>
          ))}
        </View>
      </>}
    </ModuleCard>
  );
}

export function StudiesCard({ facts, shade, onOverview, onOpen }: ModuleProps) {
  const { language, t } = useFormat();
  const { academic } = facts;
  return (
    <ModuleCard title={t('home.panelStudies')} icon="calendar-outline" shade={shade} onOverview={onOverview} openLabel={t('home.openPanel', { name: t('tab.planner') })} onOpen={onOpen}>
      {academic.pending + academic.ongoing === 0 ? <Note>{t('home.noTasks')}</Note> : (
        <View style={styles.tiles}>
          <Tile label={t('home.pending')} value={String(academic.pending)} />
          <Tile label={t('home.ongoing')} value={String(academic.ongoing)} />
          <Tile label={t('home.overdue')} value={String(academic.overdue)} tone={academic.overdue > 0 ? 'danger' : 'normal'} />
          <Tile label={t('home.dueSoon')} value={String(academic.dueSoon)} />
        </View>
      )}
      <View style={styles.statLine}>
        <Text style={[styles.rowLabel, styles.flex]}>{t('home.completedRecently')}</Text>
        <Text style={styles.rowValue}>{academic.completedRecently}</Text>
      </View>
      <View style={styles.deadlineBox}>
        <Text style={styles.caption}>{t('home.nextDeadline')}</Text>
        {academic.nextDeadline ? <>
          <Text style={styles.line} numberOfLines={1}>{academic.nextDeadline.title}</Text>
          <Text style={styles.note} numberOfLines={1}>{academic.nextDeadline.subject} · {formatTaskDeadline(academic.nextDeadline.deadline, language)}</Text>
        </> : <Text style={styles.note}>{t('home.noDeadline')}</Text>}
      </View>
    </ModuleCard>
  );
}

export function WellbeingCard({ facts, shade, onOverview, onOpen }: ModuleProps) {
  const { t, outOfFive } = useFormat();
  const { wellness } = facts;
  return (
    <ModuleCard title={t('home.panelWellbeing')} icon="heart-outline" shade={shade} onOverview={onOverview} openLabel={t('home.openPanel', { name: t('tab.mind') })} onOpen={onOpen}>
      {wellness.checkIns === 0 ? <Note>{t('home.noMoodData')}</Note> : <>
        <View style={styles.tiles}>
          <Tile third label={t('home.checkIns')} value={String(wellness.checkIns)} />
          {wellness.averageMood !== null && <Tile third label={t('home.avgMood')} value={outOfFive(wellness.averageMood)} />}
          {wellness.averageStress !== null && <Tile third label={t('home.avgStress')} value={outOfFive(wellness.averageStress)} />}
        </View>
        {wellness.moodVsPrevious && wellness.stressVsPrevious && <Note>{t('home.vsPrevious', { mood: t(directionKey[wellness.moodVsPrevious]), stress: t(directionKey[wellness.stressVsPrevious]) })}</Note>}
      </>}
      {wellness.repeatedLowMood && (
        <View style={styles.notice}>
          <Ionicons name="leaf-outline" size={18} color={colors.warning} />
          <View style={styles.flex}><Note tone="warning">{t('home.lowMoodNotice')}</Note><Note>{t('home.notAdvice')}</Note></View>
        </View>
      )}
    </ModuleCard>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, borderRadius: radius.radiusLg },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  cardBody: { flex: 1, padding: spacing.space6, gap: spacing.space5 },
  overviewLabel: { ...typography.label, color: colors.white, letterSpacing: 1.5, opacity: 0.85 },
  overviewCaption: { ...typography.label, color: colors.white, opacity: 0.85 },
  overviewAmount: { fontSize: 36, fontWeight: '700', color: colors.white, marginTop: spacing.space1, fontVariant: ['tabular-nums'] },
  overviewLine: { ...typography.body, color: colors.white, fontWeight: '600', marginTop: spacing.space1 },
  overviewSmall: { ...typography.label, color: colors.white, opacity: 0.85, marginTop: spacing.space1 },
  overviewTrack: { backgroundColor: 'rgba(255,255,255,0.3)' },
  overviewDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  overviewSplit: { flexDirection: 'row', gap: spacing.space4 },
  chips: { flexDirection: 'row', gap: spacing.space2 },
  chip: { flex: 1, borderRadius: radius.radiusMd, paddingVertical: spacing.space2, paddingHorizontal: spacing.space3, backgroundColor: 'rgba(255,255,255,0.16)' },
  chipValue: { fontSize: 18, fontWeight: '700', color: colors.white, fontVariant: ['tabular-nums'] },
  chipLabel: { ...typography.label, color: colors.white, opacity: 0.9 },
  swipeHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingHorizontal: spacing.space6, paddingBottom: spacing.space5 },
  moduleCard: { padding: spacing.space5, gap: spacing.space4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  iconWrap: { width: 40, height: 40, borderRadius: radius.radiusSm, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  title: { ...typography.sectionTitle, color: colors.textPrimary, flex: 1 },
  overviewButton: { width: 44, height: 44, borderRadius: radius.radiusFull, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  moduleBody: { flex: 1, gap: spacing.space3, overflow: 'hidden' },
  openButton: { minHeight: 48, borderRadius: radius.radiusMd, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2 },
  openText: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  caption: { ...typography.label, color: colors.textSecondary },
  amount: { fontSize: 30, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'], marginTop: spacing.space1 },
  line: { ...typography.body, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.space1 },
  danger: { color: colors.danger },
  track: { height: 6, borderRadius: radius.radiusFull, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', marginTop: spacing.space3 },
  bar: { height: '100%', borderRadius: radius.radiusFull },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2 },
  tile: { flexGrow: 1, flexBasis: '45%', minHeight: 54, borderRadius: radius.radiusMd, padding: spacing.space3, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', gap: 2 },
  tileThird: { flexBasis: '30%' },
  tileValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  tileLabel: { ...typography.label, color: colors.textSecondary },
  rows: { gap: spacing.space2 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  categoryTrack: { flex: 1, marginTop: 0 },
  rowLabel: { ...typography.label, color: colors.textPrimary },
  categoryLabel: { width: 120 },
  rowValue: { ...typography.label, color: colors.textPrimary, fontWeight: '700', minWidth: 48, textAlign: 'right', fontVariant: ['tabular-nums'] },
  statLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deadlineBox: { borderRadius: radius.radiusMd, padding: spacing.space3, backgroundColor: 'rgba(255,255,255,0.06)', gap: 2 },
  note: { ...typography.label, color: colors.textSecondary, lineHeight: 18 },
  notice: { flexDirection: 'row', gap: spacing.space2, alignItems: 'flex-start' },
});
