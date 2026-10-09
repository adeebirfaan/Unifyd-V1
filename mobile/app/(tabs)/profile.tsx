import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export default function ProfileScreen() {
  const { profile, session, signOut } = useAuth();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const { updated } = useLocalSearchParams<{ updated?: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setLoading(true);
    setError(null);
    try {
      setError((await signOut()) ? t('common.signOutError') : null);
    } catch {
      setError(t('common.signOutError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      {/* Profile is reached from the Home avatar, so it offers a direct way back. */}
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.navigate('/')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>UNIFYD</Text>
      <Text style={[styles.title, { color: tokens.screenText }]}>{t('tab.profile')}</Text>
      {profile && <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel={t('profile.settings')} style={styles.settingsButton}><Ionicons name="settings-outline" size={22} color={tokens.screenText} /></Pressable>}
      {updated === '1' && <View style={styles.success}><Ionicons name="checkmark-circle-outline" size={20} color={colors.success} /><Text style={styles.successText}>{t('profile.saved')}</Text></View>}
      {!profile ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>{t('common.unavailable')}</Text>
          <Text style={styles.emptyText}>{t('common.trySoon')}</Text>
        </View>
      ) : (
      <View style={styles.card}>
        <Avatar id={profile?.avatar_id} size={76} />
        <Text style={styles.name}>{profile?.full_name || t('profile.fallbackName')}</Text>
        <Text style={styles.email}>{profile?.email ?? session?.user.email}</Text>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Ionicons name="school-outline" size={20} color={colors.brandCyan} />
          <Text style={styles.detail}>{profile?.university}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="business-outline" size={20} color={colors.brandCyan} />
          <Text style={styles.detail}>{profile.faculty || t('profile.facultyUnset')}</Text>
        </View>
        {profile.programme && <View style={styles.detailRow}>
          <Ionicons name="book-outline" size={20} color={colors.brandCyan} />
          <Text style={styles.detail}>{profile.programme}</Text>
        </View>}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={20} color={colors.brandCyan} />
          <Text style={styles.detail}>{profile.study_year ? t('academic.year', { year: profile.study_year }) : t('profile.yearUnset')}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="notifications-outline" size={20} color={colors.brandCyan} />
          <Text style={styles.detail}>{t('profile.remind', { timing: t(profile.default_reminder_timing === '3_days' ? 'reminder.3_days' : profile.default_reminder_timing === '1_week' ? 'reminder.1_week' : 'reminder.1_day') })}</Text>
        </View>
      </View>
      )}
      {profile && <Pressable onPress={() => router.push('/edit-profile')} accessibilityRole="button" style={styles.edit}>
        <Ionicons name="create-outline" size={21} color={tokens.actionInk} />
        <Text style={[styles.editText, { color: tokens.actionInk }]}>{t('profile.edit')}</Text>
      </Pressable>}
      <Pressable onPress={handleSignOut} disabled={loading} accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }} style={[styles.signOut, { backgroundColor: tokens.destructiveBackground, borderColor: tokens.destructiveBackground }]}>
        <Ionicons name="log-out-outline" size={21} color={tokens.destructiveForeground} />
        <Text style={[styles.signOutText, { color: tokens.destructiveForeground }]}>{loading ? t('common.signingOut') : t('common.signOut')}</Text>
      </Pressable>
      {error && <Text style={[styles.error, { color: tokens.errorText }]} accessibilityRole="alert">{error}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space3 },
  eyebrow: { ...typography.label, color: colors.brandCyan, letterSpacing: 2, marginBottom: spacing.space2 },
  title: { ...typography.screenTitle, color: colors.textPrimary, marginBottom: spacing.space6 },
  settingsButton: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  success: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, padding: spacing.space3, borderRadius: radius.radiusMd, backgroundColor: colors.surface, marginBottom: spacing.space4 },
  successText: { ...typography.body, color: colors.success },
  card: { alignItems: 'center', padding: spacing.space6, borderRadius: radius.radiusLg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { ...typography.sectionTitle, color: colors.textPrimary, textAlign: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.space2 },
  name: { ...typography.sectionTitle, color: colors.textPrimary, marginTop: spacing.space4 },
  email: { ...typography.body, color: colors.textSecondary, marginTop: spacing.space1 },
  divider: { width: '100%', height: 1, backgroundColor: colors.border, marginVertical: spacing.space6 },
  detailRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: spacing.space3, marginBottom: spacing.space4 },
  detail: { ...typography.body, color: colors.textSecondary, flex: 1 },
  edit: { minHeight: 54, marginTop: spacing.space6, paddingHorizontal: spacing.space4, borderRadius: radius.radiusMd, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2 },
  editText: { ...typography.body, fontWeight: '700', color: colors.background },
  signOut: { minHeight: 54, marginTop: spacing.space6, paddingHorizontal: spacing.space4, borderRadius: radius.radiusMd, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2 },
  signOutText: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  error: { ...typography.label, color: colors.danger, marginTop: spacing.space3 },
});
