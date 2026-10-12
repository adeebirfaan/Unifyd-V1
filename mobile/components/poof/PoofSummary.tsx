import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { TranslationKey } from '@/constants/i18n';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { PoofActionId, PoofArea, PoofInsight, PoofTone } from '@/lib/poofEngine';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];
const AREA_ICONS: Record<PoofArea, IconName> = {
  money: 'wallet-outline', planner: 'calendar-outline', academic: 'school-outline', wellbeing: 'heart-outline', profile: 'person-outline',
};
const TONE_COLOURS: Record<PoofTone, string> = { attention: colors.warning, good: colors.success, info: colors.brandCyan };

export type PoofSummaryState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; insights: PoofInsight[] };

/** The data summary at the top of the chat; each insight can link to the screen it describes. */
export function PoofSummary({ state, onRetry, onAction }: { state: PoofSummaryState; onRetry: () => void; onAction: (id: PoofActionId) => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return (
    <LinearGradient testID="poof-summary" colors={['rgba(0,122,251,0.20)', 'rgba(52,193,252,0.05)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={18} color={tokens.brandCyan} />
        <Text accessibilityRole="header" style={[styles.title, { color: tokens.cardText }]}>{t('poof.summaryTitle')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('poof.summaryRefresh')} disabled={state.status === 'loading'} onPress={onRetry} hitSlop={8} style={styles.iconButton}>
          <Ionicons name="refresh" size={18} color={tokens.cardMutedText} />
        </Pressable>
      </View>
      {state.status === 'loading' && <View style={styles.row}>
        <ActivityIndicator color={tokens.brandCyan} />
        <Text style={[styles.text, { color: tokens.cardMutedText }]}>{t('poof.summaryLoading')}</Text>
      </View>}
      {state.status === 'error' && <View style={styles.errorBox}>
        <View style={styles.row}>
          <Ionicons name="cloud-offline-outline" size={18} color={tokens.cardMutedText} />
          <Text accessibilityRole="alert" style={[styles.text, { color: tokens.cardText }]}>{t('poof.summaryError')}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retry, { borderColor: tokens.border }, pressed && styles.pressed]}>
          <Text style={[styles.retryText, { color: tokens.cardText }]}>{t('poof.retry')}</Text>
        </Pressable>
      </View>}
      {state.status === 'ready' && <>
        {state.insights.map((insight) => (
          <View key={insight.id} testID={`poof-insight-${insight.id}`} style={styles.insight}>
            <View style={[styles.iconDisc, { borderColor: TONE_COLOURS[insight.tone] }]}>
              <Ionicons name={AREA_ICONS[insight.area]} size={14} color={TONE_COLOURS[insight.tone]} />
            </View>
            <View style={styles.insightBody}>
              <Text style={[styles.text, { color: tokens.cardText }]}>{insight.text}</Text>
              {insight.action && <Pressable accessibilityRole="button" onPress={() => onAction(insight.action!)} hitSlop={6} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
                <Text style={[styles.linkText, { color: tokens.brandCyan }]}>{t(`poof.action.${insight.action}` as TranslationKey)}</Text>
                <Ionicons name="chevron-forward" size={14} color={tokens.brandCyan} />
              </Pressable>}
            </View>
          </View>
        ))}
        <Text style={[styles.note, { color: tokens.cardMutedText }]}>{t('poof.summaryNote')}</Text>
      </>}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.radiusLg, borderWidth: 1, borderColor: 'rgba(52,193,252,0.28)', padding: spacing.space4, gap: spacing.space3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  title: { ...typography.label, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', flex: 1 },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  errorBox: { gap: spacing.space3 },
  text: { ...typography.body, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  insight: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space3 },
  iconDisc: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  insightBody: { flex: 1, gap: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', minHeight: 32 },
  linkText: { ...typography.label, fontSize: 14 },
  note: { ...typography.label, fontWeight: '400', fontSize: 12, lineHeight: 17 },
  retry: { minHeight: 44, borderRadius: radius.radiusMd, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  retryText: { ...typography.body, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
