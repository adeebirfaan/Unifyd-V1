import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export type ScanStartError = { message: string; canRetry: boolean };

/**
 * Step 1: a short title, one quiet privacy line, and two actions at the bottom in thumb reach. The icon tile is
 * the step's one brand-gradient element. An error appears as one row above the buttons, which stay usable.
 */
export function ScanStart({ busy, error, onBack, onCamera, onLibrary, onManual, onRetry }: {
  busy: boolean; error: ScanStartError | null;
  onBack: () => void; onCamera: () => void; onLibrary: () => void; onManual: () => void; onRetry: () => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return <View testID="scan-start" style={[styles.fill, { paddingTop: insets.top + spacing.space2, paddingBottom: Math.max(insets.bottom, spacing.space3) + spacing.space2 }]}>
    <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
    <View style={styles.centre}>
      <View style={styles.iconTile}>
        <LinearGradient colors={tokens.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Ionicons name="scan-outline" size={40} color={tokens.actionInk} />
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: tokens.screenText }]}>{t('scan.title')}</Text>
      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={14} color={tokens.mutedText} />
        <Text testID="scan-privacy" style={[styles.privacyText, { color: tokens.mutedText }]}>{t('scan.privacy')}</Text>
      </View>
    </View>
    <View style={styles.actions}>
      {error && <View testID="scan-error" style={[styles.error, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={20} color={tokens.cardErrorText} />
          <Text accessibilityRole="alert" style={[styles.errorText, { color: tokens.cardText }]}>{error.message}</Text>
        </View>
        {error.canRetry && <Pressable testID="scan-error-retry" accessibilityRole="button" onPress={onRetry} style={[styles.retry, { borderColor: tokens.border, backgroundColor: tokens.cardElevated }]}>
          <Ionicons name="refresh" size={18} color={tokens.cardText} /><Text style={[styles.retryText, { color: tokens.cardText }]}>{t('scan.retry')}</Text>
        </Pressable>}
      </View>}
      <Pressable testID="scan-camera" accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={onCamera}
        style={({ pressed }) => [styles.primary, { borderColor: tokens.primaryButtonBorder, borderWidth: tokens.primaryButtonBorderWidth }, (pressed || busy) && styles.dimmed]}>
        {busy ? <ActivityIndicator color={colors.black} /> : <><Ionicons name="camera-outline" size={21} color={colors.background} /><Text style={styles.primaryText}>{t('scan.camera')}</Text></>}
      </Pressable>
      <Pressable testID="scan-library" accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onLibrary}
        style={({ pressed }) => [styles.secondary, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }, (pressed || busy) && styles.dimmed]}>
        <Ionicons name="images-outline" size={21} color={tokens.cardText} /><Text style={[styles.secondaryText, { color: tokens.cardText }]}>{t('scan.library')}</Text>
      </Pressable>
      <Pressable testID="scan-manual" accessibilityRole="button" onPress={onManual} style={styles.manual}>
        <Text style={[styles.manualText, { color: tokens.pageAccent }]}>{t('scan.manual')}</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: spacing.space6, width: '100%', maxWidth: 568, alignSelf: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.space2 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.space3, paddingBottom: spacing.space4 },
  iconTile: { width: 88, height: 88, borderRadius: 44, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.space2 },
  title: { ...typography.screenTitle, textAlign: 'center' },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: spacing.space1, maxWidth: 340 },
  privacyText: { ...typography.label, fontWeight: '500', lineHeight: 18, flexShrink: 1, textAlign: 'center' },
  actions: { gap: spacing.space3 },
  error: { borderWidth: 1, borderRadius: radius.radiusMd, padding: spacing.space4, gap: spacing.space3 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2 },
  errorText: { ...typography.body, lineHeight: 22, flex: 1 },
  retry: { minHeight: 44, borderWidth: 1, borderRadius: radius.radiusFull, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2, alignSelf: 'flex-start', paddingHorizontal: spacing.space4 },
  retryText: { ...typography.label, fontSize: 14 },
  primary: { minHeight: 56, borderRadius: radius.radiusMd, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2, paddingHorizontal: spacing.space5 },
  primaryText: { ...typography.body, fontWeight: '700', color: colors.background },
  secondary: { minHeight: 56, borderRadius: radius.radiusMd, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2, paddingHorizontal: spacing.space5 },
  secondaryText: { ...typography.body, fontWeight: '700' },
  dimmed: { opacity: 0.7 },
  manual: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  manualText: { ...typography.body, fontWeight: '600' },
});
