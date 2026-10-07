import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { FormField } from '@/components/auth/FormField';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { authErrorKey } from '@/lib/authError';
import { supabase } from '@/lib/supabase';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export default function CreateAccountScreen() {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSignUp() {
    const cleanEmail = email.trim().toLowerCase();
    const validation = {
      email: !/^\S+@\S+\.\S+$/.test(cleanEmail) ? t('common.emailInvalid') : undefined,
      password: password.length < 6 ? t('auth.passwordShort') : undefined,
      confirmPassword: password !== confirmPassword ? t('auth.passwordMismatch') : undefined,
    };
    setFieldErrors(validation);
    if (validation.email || validation.password || validation.confirmPassword) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (signUpError) setError(t(authErrorKey(signUpError)));
      else if (!data.session) setCheckEmail(true);
      // A session returned by signUp is picked up by onAuthStateChange.
    } catch {
      setError(t('auth.createNetworkError'));
    } finally {
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <AuthScaffold title={t('auth.checkEmail')} subtitle={t('auth.checkEmailSubtitle')}>
        <View style={styles.notice}>
          <Ionicons name="mail-outline" size={28} color={colors.brandCyan} />
          <Text style={styles.noticeTitle}>{t('auth.oneMoreStep')}</Text>
          <Text style={styles.noticeText}>{t('auth.emailInstruction', { email: email.trim().toLowerCase() })}</Text>
        </View>
        <Link href="/login" style={[styles.link, { color: tokens.pageAccent }]}>{t('auth.backToSignIn')}</Link>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold title={t('auth.createTitle')} subtitle={t('auth.createSubtitle')}>
      <FormField label={t('common.email')} value={email} onChangeText={setEmail} placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" error={fieldErrors.email} />
      <FormField label={t('common.password')} value={password} onChangeText={setPassword} placeholder={t('auth.passwordHint')} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" error={fieldErrors.password} />
      <FormField label={t('auth.confirmPassword')} value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('auth.confirmPlaceholder')} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" error={fieldErrors.confirmPassword} />
      {error && <Text style={[styles.error, { color: tokens.errorText }]} accessibilityRole="alert">{error}</Text>}
      <PrimaryButton onPress={handleSignUp} loading={loading}>{t('auth.createButton')}</PrimaryButton>
      <View style={styles.switchRow}>
        <Text style={[styles.secondary, { color: tokens.mutedText }]}>{t('auth.haveAccount')}</Text>
        <Link href="/login" style={[styles.inlineLink, { color: tokens.pageAccent }]}>{t('auth.signIn')}</Link>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  error: { ...typography.label, color: colors.danger, lineHeight: 19 },
  notice: { padding: spacing.space6, gap: spacing.space3, borderRadius: radius.radiusLg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  noticeTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  noticeText: { ...typography.body, color: colors.textSecondary, lineHeight: 23 },
  link: { ...typography.body, fontWeight: '700', color: colors.brandCyan, textAlign: 'center', marginTop: spacing.space4 },
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.space2 },
  secondary: { ...typography.body, color: colors.textSecondary },
  inlineLink: { ...typography.body, fontWeight: '700', color: colors.brandCyan },
});
