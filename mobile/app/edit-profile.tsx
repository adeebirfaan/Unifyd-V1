import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { FormField } from '@/components/auth/FormField';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { AcademicFields, validateAcademicFields } from '@/components/profile/AcademicFields';
import { AvatarPicker } from '@/components/profile/AvatarPicker';
import { SelectionField } from '@/components/profile/SelectionField';
import { AVATARS, DEFAULT_AVATAR_ID } from '@/constants/avatars';
import { DEFAULT_REMINDER_TIMING, REMINDER_OPTIONS } from '@/constants/reminder-timing';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { UMPSA_NAME, facultyForLabel, programmeForLabel } from '@/constants/umpsa-academic-catalog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type FieldErrors = Partial<Record<'fullName' | 'faculty' | 'programme' | 'studyYear' | 'avatar' | 'reminder', string>>;

export default function EditProfileScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [faculty, setFaculty] = useState(profile?.faculty ?? '');
  const [programme, setProgramme] = useState(programmeForLabel(profile?.faculty, profile?.programme)?.label ?? profile?.programme ?? '');
  const [studyYear, setStudyYear] = useState(profile?.study_year?.toString() ?? '');
  const [avatarId, setAvatarId] = useState(profile?.avatar_id ?? DEFAULT_AVATAR_ID);
  const [reminderTiming, setReminderTiming] = useState(profile?.default_reminder_timing ?? DEFAULT_REMINDER_TIMING);
  const reminderOptions = REMINDER_OPTIONS.map((option) => ({ id: option.id, label: t(`reminder.${option.id}`) }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const validation: FieldErrors = {
      fullName: !fullName.trim() ? t('common.nameRequired') : undefined,
      ...validateAcademicFields(faculty, programme, studyYear, t),
      avatar: !AVATARS.some((option) => option.id === avatarId) ? t('common.avatarRequired') : undefined,
      reminder: !REMINDER_OPTIONS.some((option) => option.id === reminderTiming) ? t('edit.reminderRequired') : undefined,
    };
    setFieldErrors(validation);
    if (Object.values(validation).some(Boolean) || !session) return;

    setSaving(true);
    setError(null);
    try {
      const selectedFaculty = facultyForLabel(faculty);
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          university: UMPSA_NAME,
          faculty: faculty.trim(),
          programme: selectedFaculty?.programmes.length ? programme.trim() : null,
          study_year: Number(studyYear),
          avatar_id: avatarId,
          default_reminder_timing: reminderTiming,
        })
        .eq('id', session.user.id)
        .select('id')
        .single();

      if (updateError || !data) {
        setError(t('common.saveError'));
        return;
      }
      const refreshed = await refreshProfile();
      if (!refreshed) {
        setError(t('edit.refreshError'));
        return;
      }
      router.replace({ pathname: '/(tabs)/profile', params: { updated: '1' } });
    } catch {
      setError(t('common.saveNetworkError'));
    } finally {
      setSaving(false);
    }
  }

  if (!profile || !session) {
    return <View style={[styles.empty, { backgroundColor: tokens.screenBackground }]}><Text style={[styles.emptyTitle, { color: tokens.screenText }]}>{t('common.unavailable')}</Text><Text style={[styles.subtitle, { color: tokens.mutedText }]}>{t('common.trySoon')}</Text><PrimaryButton onPress={() => router.back()}>{t('common.back')}</PrimaryButton></View>;
  }

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.backToProfile')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
          <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('common.account')}</Text>
          <Text style={[styles.title, { color: tokens.screenText }]}>{t('profile.edit')}</Text>
          <Text style={[styles.subtitle, { color: tokens.mutedText }]}>{t('edit.subtitle')}</Text>

          <View style={styles.preview}>
            <Avatar id={avatarId} size={72} />
            <View style={styles.previewText}>
              <Text style={styles.previewName}>{fullName.trim() || t('edit.fallbackName')}</Text>
              <Text style={styles.previewHint}>{t('edit.selectedAvatar')}</Text>
            </View>
          </View>

          <View style={styles.form}>
            <FormField label={t('common.fullName')} value={fullName} onChangeText={setFullName} placeholder={t('common.fullNamePlaceholder')} autoComplete="name" textContentType="name" error={fieldErrors.fullName} />
            <View style={styles.readOnly}>
              <Text style={styles.readOnlyLabel}>{t('common.email')}</Text>
              <Text style={styles.readOnlyValue}>{profile.email ?? session.user.email ?? t('edit.emailUnavailable')}</Text>
              <Text style={styles.readOnlyHint}>{t('edit.emailHint')}</Text>
            </View>
            <AcademicFields faculty={faculty} programme={programme} studyYear={studyYear} onFacultyChange={setFaculty} onProgrammeChange={setProgramme} onStudyYearChange={setStudyYear} errors={fieldErrors} />
            <SelectionField label={t('edit.reminder')} value={reminderTiming} placeholder={t('edit.reminderPlaceholder')} options={reminderOptions} onSelect={setReminderTiming} error={fieldErrors.reminder} />
            <AvatarPicker value={avatarId} onChange={setAvatarId} error={fieldErrors.avatar} />
            {error && <Text style={[styles.error, { color: tokens.errorText }]} accessibilityRole="alert">{error}</Text>}
            <PrimaryButton onPress={() => { void handleSave(); }} loading={saving}>{t('edit.save')}</PrimaryButton>
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
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.space3, marginBottom: spacing.space3 },
  eyebrow: { ...typography.label, color: colors.brandCyan, letterSpacing: 2, marginBottom: spacing.space2 },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, lineHeight: 23, marginTop: spacing.space2 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: spacing.space4, marginTop: spacing.space6, padding: spacing.space4, borderRadius: radius.radiusLg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  previewText: { flex: 1 },
  previewName: { ...typography.sectionTitle, color: colors.textPrimary },
  previewHint: { ...typography.label, color: colors.textSecondary, marginTop: spacing.space1 },
  form: { gap: spacing.space5, marginTop: spacing.space6 },
  readOnly: { gap: spacing.space2, padding: spacing.space4, borderRadius: radius.radiusMd, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  readOnlyLabel: { ...typography.label, color: colors.textPrimary },
  readOnlyValue: { ...typography.body, color: colors.textSecondary },
  readOnlyHint: { ...typography.label, color: colors.textTertiary },
  error: { ...typography.label, color: colors.danger, lineHeight: 19 },
  empty: { flex: 1, justifyContent: 'center', gap: spacing.space4, padding: spacing.space6, backgroundColor: colors.background },
  emptyTitle: { ...typography.sectionTitle, color: colors.textPrimary },
});
