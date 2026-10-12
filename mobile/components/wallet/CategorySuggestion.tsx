import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/constants/theme';
import type { SuggestionState } from '@/hooks/useCategorySuggestion';
import type { ExpenseCategory } from '@/lib/expenseForm';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * Compact, optional suggestion above the category field. "Use" only fills the field; "Choose myself"
 * dismisses it. Nothing is ever saved from here. Low-confidence results show nothing at all.
 */
export function CategorySuggestion({ state, onUse, onDismiss }: { state: SuggestionState; onUse: (category: ExpenseCategory) => void; onDismiss: () => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  if (state.status === 'loading') {
    return <View style={styles.row} testID="category-suggestion-loading" accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={tokens.brandCyan} accessibilityLabel={t('suggest.checking')} />
      <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('suggest.checking')}</Text>
    </View>;
  }
  if (state.status === 'notEnoughData' || state.status === 'unavailable') {
    return <View style={styles.row} testID={`category-suggestion-${state.status}`}>
      <Ionicons name="information-circle-outline" size={18} color={tokens.cardMutedText} />
      <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t(state.status === 'notEnoughData' ? 'suggest.notEnough' : 'suggest.unavailable')}</Text>
    </View>;
  }
  if (state.status !== 'suggested') return null;
  const name = t(`expense.category.${state.category}`);
  const percent = Math.round(state.confidence * 100);
  return <View testID="category-suggestion" style={[styles.card, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
    <View style={styles.copy} accessible accessibilityRole="text" accessibilityLabel={t('suggest.a11y', { category: name, percent })} accessibilityLiveRegion="polite">
      <View style={styles.titleRow}>
        <Ionicons name="bulb-outline" size={18} color={tokens.brandCyan} />
        <Text style={[styles.label, { color: tokens.cardMutedText }]}>{t('suggest.title')}</Text>
      </View>
      <Text style={[styles.value, { color: tokens.cardText }]}>{t('suggest.line', { category: name, percent })}</Text>
      <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('suggest.basis')}</Text>
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={() => onUse(state.category)} style={[styles.use, { backgroundColor: tokens.brandBlue }]}>
        <Text style={[styles.useText, { color: tokens.cardText }]}>{t('suggest.use', { category: name })}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.dismiss}>
        <Text style={[styles.dismissText, { color: tokens.brandCyan }]}>{t('suggest.dismiss')}</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, marginTop: -spacing.space2 },
  card: { borderWidth: 1, borderRadius: radius.radiusMd, padding: spacing.space4, gap: spacing.space3 },
  copy: { gap: spacing.space1 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  label: { ...typography.label }, value: { ...typography.body, fontWeight: '700' }, hint: { ...typography.label, lineHeight: 19, flexShrink: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.space3 },
  use: { minHeight: 44, borderRadius: radius.radiusSm, paddingHorizontal: spacing.space4, alignItems: 'center', justifyContent: 'center' },
  useText: { ...typography.body, fontWeight: '700' },
  dismiss: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.space2 }, dismissText: { ...typography.body, fontWeight: '600' },
});
