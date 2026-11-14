import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { SUPPORT_LINES, UMPSA_COUNSELLING } from '@/constants/supportLines';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

function Row({ icon, label, onPress, accessibilityLabel, testID }: { icon: IconName; label: string; onPress: () => void; accessibilityLabel: string; testID: string }) {
  const { tokens } = useAppearance();
  return (
    <Pressable testID={testID} accessibilityRole="link" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={tokens.brandCyan} />
      <Text style={[styles.rowText, { color: tokens.cardText }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={tokens.cardMutedText} />
    </Pressable>
  );
}

// Wellbeing Phase 1 (SRS-FR-1101): static help contacts. No data is loaded, saved, or sent.
// Calm by design (design system "Wellbeing support"): few words, no alarm colours, no gradient, no Poof.
export default function GetHelpScreen() {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [linkError, setLinkError] = useState(false);

  function open(url: string) {
    setLinkError(false);
    Linking.openURL(url).catch(() => setLinkError(true));
  }

  const centre = t('wellbeing.help.centre');
  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={tokens.screenText} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: tokens.screenText }]}>{t('wellbeing.help.title')}</Text>
      <Text style={[styles.intro, { color: tokens.mutedText }]}>{t('wellbeing.help.intro')}</Text>

      <View testID="help-counsellor" style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <Text accessibilityRole="header" style={[styles.cardTitle, { color: tokens.cardText }]}>{t('wellbeing.help.counsellorTitle')}</Text>
        <Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('wellbeing.help.counsellorBody')}</Text>
        <Pressable testID="help-book" accessibilityRole="link" accessibilityLabel={t('wellbeing.help.bookA11y')} onPress={() => open(UMPSA_COUNSELLING.bookingUrl)}
          style={({ pressed }) => [styles.primary, { backgroundColor: tokens.brandBlue }, pressed && styles.pressed]}>
          <Ionicons name="calendar-outline" size={20} color={colors.white} />
          <Text style={styles.primaryText}>{t('wellbeing.help.book')}</Text>
        </Pressable>
        <Text style={[styles.path, { color: tokens.cardMutedText }]}>{t('wellbeing.help.bookPath')}</Text>
        <Row testID="help-counsellors" icon="people-outline" label={t('wellbeing.help.counsellors')} accessibilityLabel={t('wellbeing.help.counsellors')} onPress={() => open(UMPSA_COUNSELLING.counsellorsUrl)} />
        <Row testID="help-centre" icon="call-outline" label={centre} accessibilityLabel={t('poof.call', { name: centre })} onPress={() => open(`tel:${UMPSA_COUNSELLING.tel}`)} />
        <Text style={[styles.path, { color: tokens.cardMutedText }]}>{t('wellbeing.help.centreHours')}</Text>
      </View>

      <View testID="help-now" style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <Text accessibilityRole="header" style={[styles.cardTitle, { color: tokens.cardText }]}>{t('wellbeing.help.nowTitle')}</Text>
        {[SUPPORT_LINES[1], SUPPORT_LINES[2], SUPPORT_LINES[0]].map((line) => (
          <Row key={line.tel} testID={`help-line-${line.tel}`} icon="call-outline" label={t(line.key)} accessibilityLabel={t('poof.call', { name: t(line.key) })} onPress={() => open(`tel:${line.tel}`)} />
        ))}
      </View>

      {linkError && <Text accessibilityRole="alert" style={[styles.note, { color: tokens.mutedText }]}>{t('wellbeing.help.linkError')}</Text>}
      <Text style={[styles.note, { color: tokens.mutedText }]}>{t('wellbeing.help.footer')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.space3, marginBottom: spacing.space3 },
  title: { ...typography.screenTitle },
  intro: { ...typography.body, lineHeight: 23, marginTop: spacing.space2, marginBottom: spacing.space6 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space3, marginBottom: spacing.space4 },
  cardTitle: { ...typography.sectionTitle },
  body: { ...typography.body, lineHeight: 23 },
  primary: { minHeight: 56, borderRadius: radius.radiusMd, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2, paddingHorizontal: spacing.space5, marginTop: spacing.space1 },
  primaryText: { ...typography.body, fontWeight: '700', color: colors.white },
  path: { ...typography.label, lineHeight: 18 },
  row: { minHeight: 56, borderWidth: 1, borderRadius: radius.radiusMd, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingHorizontal: spacing.space4 },
  rowText: { ...typography.body, fontWeight: '600', flex: 1 },
  pressed: { opacity: 0.7 },
  note: { ...typography.label, lineHeight: 18, marginTop: spacing.space2 },
});
