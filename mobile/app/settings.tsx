import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { LANGUAGE_OPTIONS } from '@/constants/i18n';
import type { LanguagePreference, TranslationKey } from '@/constants/i18n';
import { radius, spacing, typography } from '@/constants/theme';
import type { ThemePreference } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const appearanceOptions: ThemePreference[] = ['system', 'light', 'dark'];

export default function SettingsScreen() {
  const { preference, savePreference, tokens } = useAppearance();
  const { language, saveLanguage, t } = useI18n();
  const [expandedSection, setExpandedSection] = useState<'appearance' | 'language' | null>(null);
  const [saving, setSaving] = useState<'appearance' | 'language' | null>(null);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);

  function toggle(section: 'appearance' | 'language') {
    if (saving) return;
    setExpandedSection((current) => current === section ? null : section);
    setError(null);
    setMessage(null);
  }

  async function chooseAppearance(value: ThemePreference) {
    if (saving) return;
    if (value === preference) {
      toggle('appearance');
      return;
    }
    setSaving('appearance');
    setError(null);
    setMessage(null);
    try {
      const result = await savePreference(value);
      if (result) setError('settings.saveError');
      else {
        setExpandedSection(null);
        setMessage('settings.saved');
      }
    } catch {
      setError('settings.saveError');
    } finally {
      setSaving(null);
    }
  }

  async function chooseLanguage(value: LanguagePreference) {
    if (saving) return;
    if (value === language) {
      toggle('language');
      return;
    }
    setSaving('language');
    setError(null);
    setMessage(null);
    try {
      const saved = await saveLanguage(value);
      if (!saved) setError('settings.languageSaveError');
      else {
        setExpandedSection(null);
        setMessage('settings.languageSaved');
      }
    } catch {
      setError('settings.languageSaveError');
    } finally {
      setSaving(null);
    }
  }

  const appearanceLabel = t(`settings.${preference}`);
  const languageLabel = LANGUAGE_OPTIONS.find((option) => option.id === language)?.label ?? LANGUAGE_OPTIONS[0].label;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.backToProfile')} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={tokens.screenText} />
      </Pressable>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('common.account')}</Text>
      <Text style={[styles.title, { color: tokens.screenText }]}>{t('settings.title')}</Text>
      <Text style={[styles.subtitle, { color: tokens.mutedText }]}>{t('settings.subtitle')}</Text>
      <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <Pressable
          onPress={() => toggle('appearance')}
          disabled={saving !== null}
          accessibilityRole="button"
          accessibilityLabel={`${t('settings.appearance')}: ${appearanceLabel}`}
          accessibilityState={{ expanded: expandedSection === 'appearance', disabled: saving !== null }}
          style={styles.sectionHeader}
        >
          <View style={styles.optionCopy}>
            <Text style={[styles.sectionTitle, { color: tokens.cardText }]}>{t('settings.appearance')}</Text>
            <Text style={[styles.currentValue, { color: tokens.cardMutedText }]}>{appearanceLabel}</Text>
          </View>
          {saving === 'appearance' ? <ActivityIndicator color={tokens.brandCyan} /> : <Ionicons name={expandedSection === 'appearance' ? 'chevron-up' : 'chevron-down'} size={21} color={tokens.cardMutedText} />}
        </Pressable>
        {expandedSection === 'appearance' && (
          <View>
        {appearanceOptions.map((option) => (
          <Pressable
            key={option}
            onPress={() => { void chooseAppearance(option); }}
            disabled={saving !== null}
            accessibilityRole="radio"
            accessibilityState={{ selected: preference === option, disabled: saving !== null }}
            style={[styles.option, { borderTopColor: tokens.border }]}
          >
            <View style={styles.optionCopy}>
              <Text style={[styles.optionLabel, { color: tokens.cardText }]}>{t(`settings.${option}`)}</Text>
              <Text style={[styles.optionDescription, { color: tokens.cardMutedText }]}>{t(`settings.${option}Description`)}</Text>
            </View>
            <Ionicons name={preference === option ? 'radio-button-on' : 'radio-button-off'} size={22} color={preference === option ? tokens.brandCyan : tokens.subtleText} />
          </Pressable>
        ))}
          </View>
        )}
        <View style={[styles.divider, { backgroundColor: tokens.border }]} />
        <Pressable
          onPress={() => toggle('language')}
          disabled={saving !== null}
          accessibilityRole="button"
          accessibilityLabel={`${t('language.label')}: ${languageLabel}`}
          accessibilityState={{ expanded: expandedSection === 'language', disabled: saving !== null }}
          style={styles.sectionHeader}
        >
          <View style={styles.optionCopy}>
            <Text style={[styles.sectionTitle, { color: tokens.cardText }]}>{t('language.label')}</Text>
            <Text style={[styles.currentValue, { color: tokens.cardMutedText }]}>{languageLabel}</Text>
          </View>
          {saving === 'language' ? <ActivityIndicator color={tokens.brandCyan} /> : <Ionicons name={expandedSection === 'language' ? 'chevron-up' : 'chevron-down'} size={21} color={tokens.cardMutedText} />}
        </Pressable>
        {expandedSection === 'language' && (
          <View>
        {LANGUAGE_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => { void chooseLanguage(option.id); }}
            disabled={saving !== null}
            accessibilityRole="radio"
            accessibilityState={{ selected: language === option.id, disabled: saving !== null }}
            style={[styles.option, { borderTopColor: tokens.border }]}
          >
            <Text style={[styles.optionLabel, { color: tokens.cardText, flex: 1 }]}>{option.label}</Text>
            <Ionicons name={language === option.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={language === option.id ? tokens.brandCyan : tokens.subtleText} />
          </Pressable>
        ))}
          </View>
        )}
      </View>
      <View style={[styles.card, styles.legalCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, styles.legalTitle, { color: tokens.cardText }]}>{t('legal.section')}</Text>
        <Pressable onPress={() => router.push('/privacy-policy')} accessibilityRole="button" accessibilityLabel={t('legal.privacyTitle')} style={styles.legalRow}>
          <Ionicons name="shield-checkmark-outline" size={22} color={tokens.brandCyan} />
          <Text style={[styles.legalLabel, { color: tokens.cardText }]}>{t('legal.privacyTitle')}</Text>
          <Ionicons name="chevron-forward" size={20} color={tokens.cardMutedText} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: tokens.border }]} />
        <Pressable onPress={() => router.push('/terms-of-use')} accessibilityRole="button" accessibilityLabel={t('legal.termsTitle')} style={styles.legalRow}>
          <Ionicons name="document-text-outline" size={22} color={tokens.brandCyan} />
          <Text style={[styles.legalLabel, { color: tokens.cardText }]}>{t('legal.termsTitle')}</Text>
          <Ionicons name="chevron-forward" size={20} color={tokens.cardMutedText} />
        </Pressable>
      </View>
      {message && <Text style={[styles.success, { color: tokens.successText }]} accessibilityRole="alert">{t(message)}</Text>}
      {error && <Text style={[styles.error, { color: tokens.errorText }]} accessibilityRole="alert">{t(error)}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.space3, marginBottom: spacing.space3 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 },
  title: { ...typography.screenTitle },
  subtitle: { ...typography.body, lineHeight: 23, marginTop: spacing.space2, marginBottom: spacing.space6 },
  card: { padding: spacing.space4, borderRadius: radius.radiusLg, borderWidth: 1 },
  legalCard: { marginTop: spacing.space4 },
  legalTitle: { marginBottom: spacing.space2 },
  legalRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingVertical: spacing.space3 },
  legalLabel: { ...typography.body, fontWeight: '600', flex: 1 },
  sectionHeader: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingVertical: spacing.space3 },
  sectionTitle: { ...typography.sectionTitle },
  currentValue: { ...typography.label },
  divider: { height: 1 },
  option: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingVertical: spacing.space3, borderTopWidth: 1 },
  optionCopy: { flex: 1, gap: spacing.space1 },
  optionLabel: { ...typography.body, fontWeight: '600' },
  optionDescription: { ...typography.label },
  success: { ...typography.label, marginTop: spacing.space4 },
  error: { ...typography.label, marginTop: spacing.space4 },
});
