import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * The amber "Check" marker beside a Details label for a field the server flagged for review. An icon and the word,
 * never colour alone; screen readers get "needs review" through the field's own label instead.
 */
export function ReviewFlag({ testID }: { testID?: string }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return <View testID={testID} style={styles.flag} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
    <Ionicons name="alert-circle-outline" size={16} color={tokens.cardWarningText} />
    <Text style={[styles.text, { color: tokens.cardWarningText }]}>{t('scan.check')}</Text>
  </View>;
}

const styles = StyleSheet.create({
  flag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  text: { ...typography.label },
});
