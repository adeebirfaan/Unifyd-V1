import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { ModuleCard } from '@/components/ModuleCard';
import { Screen } from '@/components/Screen';
import { DEFAULT_AVATAR_ID } from '@/constants/avatars';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export default function HomeScreen() {
  const { profile } = useAuth();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || t('home.there');
  return (
    <Screen>
      <View style={styles.brandRow}>
        <Image source={require('../../assets/brand/unifyd-logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="Unifyd logo" />
        <Text style={[styles.brandName, { color: tokens.screenText }]}>unifyd</Text>
      </View>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('home.space')}</Text>
      <View style={styles.greetingRow}>
        <Text style={[styles.greeting, { color: tokens.screenText }]}>{t('home.greeting', { name: firstName })}</Text>
        <View style={styles.avatarFrame}>
          <Avatar id={profile?.avatar_id ?? DEFAULT_AVATAR_ID} size={52} />
          <View pointerEvents="none" style={[styles.avatarOutline, { borderColor: tokens.homeAvatarOutline }]} />
        </View>
      </View>
      <Text style={[styles.intro, { color: tokens.mutedText }]}>{t('home.intro')}</Text>
      <LinearGradient colors={colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroLabel}>{t('home.overview')}</Text>
        <Text style={styles.heroTitle}>{t('home.heroTitle')}</Text>
        <Text style={styles.heroDescription}>{t('home.heroDescription')}</Text>
      </LinearGradient>
      <Text style={[styles.sectionHeading, { color: tokens.screenText }]}>{t('home.explore')}</Text>
      <View style={styles.cards}>
        <ModuleCard title={t('tab.wallet')} description={t('home.walletDescription')} icon="wallet-outline" />
        <ModuleCard title={t('tab.planner')} description={t('home.plannerDescription')} icon="calendar-outline" />
        <ModuleCard title={t('home.mood')} description={t('home.moodDescription')} icon="heart-outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, marginBottom: spacing.space8 },
  logo: { width: 38, height: 38, borderRadius: 9 },
  brandName: { ...typography.sectionTitle, color: colors.textPrimary, letterSpacing: -0.5 },
  eyebrow: { ...typography.label, color: colors.brandCyan, letterSpacing: 2, marginBottom: spacing.space2 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  avatarFrame: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
  avatarOutline: { ...StyleSheet.absoluteFill, borderRadius: 26, borderWidth: 1.5 },
  greeting: { ...typography.display, color: colors.textPrimary, lineHeight: 38, flex: 1 },
  intro: { ...typography.body, color: colors.textSecondary, marginTop: spacing.space2, marginBottom: spacing.space8 },
  hero: { minHeight: 184, borderRadius: radius.radiusLg, padding: spacing.space6, justifyContent: 'space-between' },
  heroLabel: { ...typography.label, color: colors.white, letterSpacing: 1.5, opacity: 0.85 },
  heroTitle: { fontSize: 24, fontWeight: '700', color: colors.white, marginTop: spacing.space6 },
  heroDescription: { ...typography.body, color: colors.white, opacity: 0.9, lineHeight: 22, marginTop: spacing.space2 },
  sectionHeading: { ...typography.sectionTitle, color: colors.textPrimary, marginTop: spacing.space8, marginBottom: spacing.space4 },
  cards: { gap: spacing.space3 },
});
