import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormField } from '@/components/auth/FormField';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { AcademicFields, validateAcademicFields } from '@/components/profile/AcademicFields';
import { AvatarPicker } from '@/components/profile/AvatarPicker';
import { SelectionField } from '@/components/profile/SelectionField';
import { isAvatarId, resolveAvatarId } from '@/constants/avatars';
import { LANGUAGE_OPTIONS, normalizeLanguagePreference } from '@/constants/i18n';
import { colors, spacing, typography } from '@/constants/theme';
import { UMPSA_NAME, facultyForLabel, programmeForLabel } from '@/constants/umpsa-academic-catalog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export default function OnboardingScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [faculty, setFaculty] = useState(profile?.faculty ?? '');
  const [programme, setProgramme] = useState(programmeForLabel(profile?.faculty, profile?.programme)?.label ?? profile?.programme ?? '');
  const [studyYear, setStudyYear] = useState(profile?.study_year?.toString() ?? '');
  const [avatarId, setAvatarId] = useState(() => resolveAvatarId(profile?.avatar_id));
  const [language, setLanguage] = useState<string>(normalizeLanguagePreference(profile?.language_preference));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'fullName' | 'faculty' | 'programme' | 'studyYear' | 'avatar' | 'language', string>>>({});
  const [loading, setLoading] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSave() {
    const name = fullName.trim();
    const facultyName = faculty.trim();
    const programmeName = facultyForLabel(facultyName)?.programmes.length ? programme.trim() : null;
    const year = Number(studyYear);
    const validation = {
      fullName: !name ? t('common.nameRequired') : undefined,
      ...validateAcademicFields(facultyName, programme, studyYear, t),
      avatar: !isAvatarId(avatarId) ? t('common.avatarRequired') : undefined,
      language: !LANGUAGE_OPTIONS.some((option) => option.id === language) ? t('language.required') : undefined,
    };
    setFieldErrors(validation);
    if (Object.values(validation).some(Boolean)) {
      return;
    }
    if (!session) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          university: UMPSA_NAME,
          faculty: facultyName,
          programme: programmeName,
          study_year: year,
          avatar_id: avatarId,
          language_preference: language,
          onboarding_completed: true,
        })
        .eq('id', session.user.id)
        .select('id')
        .single();

      if (updateError || !data) {
        setError(t('common.saveError'));
        return;
      }
      await refreshProfile();
    } catch {
      setError(t('common.saveNetworkError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      setSignOutError((await signOut()) ? t('common.signOutError') : null);
    } catch {
      setSignOutError(t('common.signOutError'));
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space6, paddingBottom: insets.bottom + spacing.space8 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('onboarding.welcome')}</Text>
          <Text style={[styles.title, { color: tokens.screenText }]}>{t('onboarding.title')}</Text>
          <Text style={[styles.subtitle, { color: tokens.mutedText }]}>{t('onboarding.subtitle')}</Text>

          <View style={styles.form}>
            <FormField label={t('common.fullName')} value={fullName} onChangeText={setFullName} placeholder={t('common.fullNamePlaceholder')} autoComplete="name" textContentType="name" error={fieldErrors.fullName} />
            <AcademicFields faculty={faculty} programme={programme} studyYear={studyYear} onFacultyChange={setFaculty} onProgrammeChange={setProgramme} onStudyYearChange={setStudyYear} errors={fieldErrors} />
            <SelectionField label={t('language.label')} value={language} placeholder={t('language.placeholder')} options={LANGUAGE_OPTIONS} onSelect={setLanguage} error={fieldErrors.language} />
            <AvatarPicker value={avatarId} onChange={setAvatarId} error={fieldErrors.avatar} />
            {error && <Text style={[styles.error, { color: tokens.errorText }]} accessibilityRole="alert">{error}</Text>}
            <PrimaryButton onPress={handleSave} loading={loading}>{t('onboarding.complete')}</PrimaryButton>
            <Pressable onPress={handleSignOut} accessibilityRole="button" style={styles.signOutButton}>
              <Text style={[styles.signOutText, { color: tokens.mutedText }]}>{t('common.signOut')}</Text>
            </Pressable>
            {signOutError && <Text style={[styles.error, { color: tokens.errorText }]}>{signOutError}</Text>}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.space6 },
  inner: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  eyebrow: { ...typography.label, color: colors.brandCyan, letterSpacing: 2, marginBottom: spacing.space2 },
  title: { ...typography.display, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, lineHeight: 23, marginTop: spacing.space2 },
  form: { gap: spacing.space5, marginTop: spacing.space8 },
  error: { ...typography.label, color: colors.danger, lineHeight: 19 },
  signOutButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  signOutText: { ...typography.body, color: colors.textSecondary },
});
