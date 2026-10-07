import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import type { TranslationKey } from '@/constants/i18n';
import { radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type LegalSection = { title: TranslationKey; body: TranslationKey };

const documents: Record<'privacy' | 'terms', { title: TranslationKey; sections: readonly LegalSection[] }> = {
  privacy: {
    title: 'legal.privacyTitle',
    sections: [
      { title: 'legal.privacy.purpose.title', body: 'legal.privacy.purpose.body' },
      { title: 'legal.privacy.collected.title', body: 'legal.privacy.collected.body' },
      { title: 'legal.privacy.use.title', body: 'legal.privacy.use.body' },
      { title: 'legal.privacy.storage.title', body: 'legal.privacy.storage.body' },
      { title: 'legal.privacy.ai.title', body: 'legal.privacy.ai.body' },
      { title: 'legal.privacy.choices.title', body: 'legal.privacy.choices.body' },
      { title: 'legal.privacy.limit.title', body: 'legal.privacy.limit.body' },
    ],
  },
  terms: {
    title: 'legal.termsTitle',
    sections: [
      { title: 'legal.terms.acceptance.title', body: 'legal.terms.acceptance.body' },
      { title: 'legal.terms.responsible.title', body: 'legal.terms.responsible.body' },
      { title: 'legal.terms.account.title', body: 'legal.terms.account.body' },
      { title: 'legal.terms.accuracy.title', body: 'legal.terms.accuracy.body' },
      { title: 'legal.terms.advice.title', body: 'legal.terms.advice.body' },
      { title: 'legal.terms.ai.title', body: 'legal.terms.ai.body' },
      { title: 'legal.terms.changes.title', body: 'legal.terms.changes.body' },
      { title: 'legal.terms.contact.title', body: 'legal.terms.contact.body' },
    ],
  },
};

export function LegalPage({ document }: { document: 'privacy' | 'terms' }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const content = documents[document];

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={tokens.screenText} />
      </Pressable>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('common.account')}</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: tokens.screenText }]}>{t(content.title)}</Text>
      <Text style={[styles.updated, { color: tokens.mutedText }]}>{t('legal.lastUpdated')}</Text>
      <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        {content.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: tokens.cardText }]}>{t(section.title)}</Text>
            <Text style={[styles.body, { color: tokens.cardMutedText }]}>{t(section.body)}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.space3, marginBottom: spacing.space3 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 },
  title: { ...typography.screenTitle },
  updated: { ...typography.label, marginTop: spacing.space2, marginBottom: spacing.space6 },
  card: { padding: spacing.space6, borderRadius: radius.radiusLg, borderWidth: 1, gap: spacing.space6 },
  section: { gap: spacing.space2 },
  sectionTitle: { ...typography.sectionTitle },
  body: { ...typography.body, lineHeight: 24 },
});
