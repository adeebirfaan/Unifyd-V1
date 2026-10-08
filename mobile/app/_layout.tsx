import { DarkTheme, Stack, ThemeProvider, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { colors, spacing, typography } from '@/constants/theme';
import { clearTaskReminders, observeTaskReminderTaps, syncTaskReminders } from '@/lib/taskReminders';
import { AppearanceProvider, useAppearance } from '@/providers/AppearanceProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { LanguageProvider, useI18n } from '@/providers/LanguageProvider';

function RootNavigator() {
  const { gate, session, error, retry, signOut } = useAuth();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  if (gate === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: tokens.screenBackground }]}>
        <ActivityIndicator size="large" color={colors.brandCyan} />
        <Text style={[styles.message, { color: tokens.mutedText }]}>{t('gate.opening')}</Text>
      </View>
    );
  }

  if (gate === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: tokens.screenBackground }]}>
        <Text style={[styles.heading, { color: tokens.screenText }]}>{t('gate.pause')}</Text>
        <Text style={[styles.message, { color: tokens.mutedText }]}>{error === 'We could not check your session. Please try again.' ? t('gate.sessionError') : t('gate.profileError')}</Text>
        <View style={styles.action}><PrimaryButton onPress={() => { void retry(); }}>{t('gate.retry')}</PrimaryButton></View>
        {session && (
          <Pressable onPress={() => { void signOut().then(setSignOutError).catch(() => setSignOutError('We could not sign you out. Please try again.')); }} accessibilityRole="button" style={styles.signOutButton}>
            <Text style={[styles.signOut, { color: tokens.pageAccent }]}>{t('common.signOut')}</Text>
          </Pressable>
        )}
        {signOutError && <Text style={[styles.error, { color: tokens.errorText }]}>{t('common.signOutError')}</Text>}
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.screenBackground } }}>
      <Stack.Protected guard={gate === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'onboarding'}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'ready'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="add-expense" />
        <Stack.Screen name="scan-receipt" />
        <Stack.Screen name="set-budget" />
        <Stack.Screen name="expense-detail" />
        <Stack.Screen name="edit-expense" />
        <Stack.Screen name="add-task" />
        <Stack.Screen name="task-detail" />
        <Stack.Screen name="edit-task" />
        <Stack.Screen name="my-semester" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="terms-of-use" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider><LanguageProvider><AppearanceProvider><AppTheme /></AppearanceProvider></LanguageProvider></AuthProvider>
  );
}

function AppTheme() {
  const { mode, tokens } = useAppearance();
  const navigationTheme = {
    ...DarkTheme,
    dark: mode === 'dark',
    colors: { ...DarkTheme.colors, background: tokens.screenBackground, card: tokens.cardBackground, text: tokens.screenText, border: tokens.border, primary: tokens.brandBlue },
  };
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <TaskReminderCoordinator />
      <RootNavigator />
    </ThemeProvider>
  );
}

function TaskReminderCoordinator() {
  const { gate, session } = useAuth();
  const { language } = useI18n();
  const userId = session?.user.id;

  useEffect(() => {
    if (gate === 'signedOut') { void clearTaskReminders(); return; }
    if (gate !== 'ready' || !userId) return;
    void syncTaskReminders(userId, language);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncTaskReminders(userId, language);
    });
    let active = true;
    let stopObserving: () => void = () => undefined;
    void observeTaskReminderTaps(userId, (taskId) => router.push({ pathname: '/task-detail', params: { id: taskId } }))
      .then((stop) => { if (active) stopObserving = stop; else stop(); })
      .catch(() => undefined);
    return () => { active = false; appState.remove(); stopObserving(); };
  }, [gate, userId, language]);

  return null;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.space4, padding: spacing.space6, backgroundColor: colors.background },
  heading: { ...typography.screenTitle, color: colors.textPrimary, textAlign: 'center' },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 23 },
  action: { width: '100%', maxWidth: 300, marginTop: spacing.space3 },
  signOutButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.space3 },
  signOut: { ...typography.body, color: colors.brandCyan },
  error: { ...typography.label, color: colors.danger, textAlign: 'center' },
});
