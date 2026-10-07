import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { FormField } from '@/components/auth/FormField';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { colors, spacing, typography } from '@/constants/theme';
import { authErrorKey } from '@/lib/authError';
import { supabase } from '@/lib/supabase';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export default function LoginScreen() {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
    const validation = {
      email: !/^\S+@\S+\.\S+$/.test(cleanEmail) ? t('common.emailInvalid') : undefined,
      password: !password ? t('common.passwordRequired') : undefined,
    };
    setFieldErrors(validation);
    if (validation.email || validation.password) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (signInError) setError(t(authErrorKey(signInError)));
    } catch {
      setError(t('auth.signInNetworkError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold title={t('auth.welcome')} subtitle={t('auth.signInSubtitle')}>
      <FormField label={t('common.email')} value={email} onChangeText={setEmail} placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" error={fieldErrors.email} />
      <FormField label={t('common.password')} value={password} onChangeText={setPassword} placeholder={t('auth.passwordPlaceholder')} secure autoCapitalize="none" autoComplete="current-password" textContentType="password" error={fieldErrors.password} />
      {error && <Text style={[styles.error, { color: tokens.errorText }]} accessibilityRole="alert">{error}</Text>}
      <PrimaryButton onPress={handleLogin} loading={loading}>{t('auth.signIn')}</PrimaryButton>
      <View style={styles.switchRow}>
        <Text style={[styles.secondary, { color: tokens.mutedText }]}>{t('auth.newHere')}</Text>
        <Link href="/create-account" style={[styles.link, { color: tokens.pageAccent }]}>{t('auth.createAccount')}</Link>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  error: { ...typography.label, color: colors.danger, lineHeight: 19 },
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.space2 },
  secondary: { ...typography.body, color: colors.textSecondary },
  link: { ...typography.body, fontWeight: '700', color: colors.brandCyan },
});
