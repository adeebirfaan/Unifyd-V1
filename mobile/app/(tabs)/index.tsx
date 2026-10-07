import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ModuleCard } from '@/components/ModuleCard';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <Screen>
      <View style={styles.brandRow}>
        <Image source={require('../../assets/brand/unifyd-logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="Unifyd logo" />
        <Text style={styles.brandName}>unifyd</Text>
      </View>
      <Text style={styles.eyebrow}>YOUR SPACE</Text>
      <Text style={styles.greeting}>Good evening, Adeeb</Text>
      <Text style={styles.intro}>A clear view of what matters today.</Text>
      <LinearGradient colors={colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroLabel}>YOUR OVERVIEW</Text>
        <Text style={styles.heroTitle}>Everything in one place.</Text>
        <Text style={styles.heroDescription}>Your money, plans, and wellbeing will come together here.</Text>
      </LinearGradient>
      <Text style={styles.sectionHeading}>Explore your space</Text>
      <View style={styles.cards}>
        <ModuleCard title="Wallet" description="Your money, at a glance" icon="wallet-outline" />
        <ModuleCard title="Planner" description="Keep your next steps in view" icon="calendar-outline" />
        <ModuleCard title="Mood" description="Make space to check in" icon="heart-outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, marginBottom: spacing.space8 },
  logo: { width: 38, height: 38, borderRadius: 9 },
  brandName: { ...typography.sectionTitle, color: colors.textPrimary, letterSpacing: -0.5 },
  eyebrow: { ...typography.label, color: colors.brandCyan, letterSpacing: 2, marginBottom: spacing.space2 },
  greeting: { ...typography.display, color: colors.textPrimary, lineHeight: 38 },
  intro: { ...typography.body, color: colors.textSecondary, marginTop: spacing.space2, marginBottom: spacing.space8 },
  hero: { minHeight: 184, borderRadius: radius.radiusLg, padding: spacing.space6, justifyContent: 'space-between' },
  heroLabel: { ...typography.label, color: colors.white, letterSpacing: 1.5, opacity: 0.85 },
  heroTitle: { fontSize: 24, fontWeight: '700', color: colors.white, marginTop: spacing.space6 },
  heroDescription: { ...typography.body, color: colors.white, opacity: 0.9, lineHeight: 22, marginTop: spacing.space2 },
  sectionHeading: { ...typography.sectionTitle, color: colors.textPrimary, marginTop: spacing.space8, marginBottom: spacing.space4 },
  cards: { gap: spacing.space3 },
});
