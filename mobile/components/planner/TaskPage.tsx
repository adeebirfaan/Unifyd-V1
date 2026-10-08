import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { radius, spacing, typography } from '@/constants/theme';
import type { TranslationKey } from '@/constants/i18n';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export function TaskPageHeader({ titleKey, helperKey }: { titleKey: TranslationKey; helperKey?: TranslationKey }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
    <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('task.eyebrow')}</Text>
    <Text style={[styles.title, { color: tokens.screenText }]}>{t(titleKey)}</Text>
    {helperKey && <Text style={[styles.helper, { color: tokens.mutedText }]}>{t(helperKey)}</Text>}
  </>;
}

export function TaskLoadCard({ state, onRetry }: { state: 'loading' | 'error' | 'notFound'; onRetry: () => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    {state === 'loading' && <ActivityIndicator size="large" color={tokens.brandCyan} />}
    <Text style={[styles.message, { color: tokens.cardMutedText }]}>{state === 'loading' ? t('task.detailLoading') : state === 'notFound' ? t('task.notFound') : t('task.detailError')}</Text>
    {state !== 'loading' && <PrimaryButton onPress={onRetry}>{t('task.retry')}</PrimaryButton>}
  </View>;
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space5 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 },
  title: { ...typography.screenTitle, marginBottom: spacing.space2 }, helper: { ...typography.body, lineHeight: 23, marginBottom: spacing.space6 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space4 }, message: { ...typography.body, lineHeight: 23 },
});
