import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReceiptReadingRing } from '@/components/scan/ReceiptReadingRing';
import { radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const useNative = Platform.OS !== 'web';

/**
 * Step 2: a full-screen loading state on the page background (nothing half-built behind it). "Preparing your photo…"
 * while the photo is converted on the device, then "Reading your receipt…" while the server reads it. After 20 s a
 * card offers Retry and Enter manually; the ring keeps moving. The status text cross-fades (200 ms) when it changes.
 */
export function ScanReading({ phase, slow, reduceMotion, onCancel, onRetry, onManual }: {
  phase: 'preparing' | 'reading'; slow: boolean; reduceMotion: boolean;
  onCancel: () => void; onRetry: () => void; onManual: () => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [fade] = useState(() => new Animated.Value(1));
  const shown = useRef(phase);
  useEffect(() => {
    if (shown.current === phase) return;
    shown.current = phase;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: useNative }).start();
  }, [phase, fade]);

  const status = t(phase === 'preparing' ? 'scan.preparing' : 'scan.reading');
  return <View testID="scan-reading" {...({ dataSet: { phase } } as object)} style={[styles.fill, { paddingTop: insets.top + spacing.space2, paddingBottom: Math.max(insets.bottom, spacing.space3) + spacing.space2 }]}>
    <Pressable testID="scan-cancel" onPress={onCancel} accessibilityRole="button" accessibilityLabel={t('scan.cancel')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
    <View style={styles.centre}>
      <ReceiptReadingRing reduceMotion={reduceMotion} />
      <Animated.Text testID="scan-status" accessibilityLiveRegion="polite" aria-live="polite" style={[styles.status, { color: tokens.screenText, opacity: fade }]}>{status}</Animated.Text>
      {slow && <View testID="scan-slow" accessibilityLiveRegion="polite" style={[styles.slow, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <Text accessibilityRole="alert" style={[styles.slowTitle, { color: tokens.cardText }]}>{t('scan.slowTitle')}</Text>
        <Text style={[styles.slowBody, { color: tokens.cardMutedText }]}>{t('scan.slowBody')}</Text>
        <View style={styles.slowActions}>
          <Pressable testID="scan-slow-retry" accessibilityRole="button" onPress={onRetry} style={[styles.slowButton, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
            <Ionicons name="refresh" size={18} color={tokens.cardText} /><Text style={[styles.slowButtonText, { color: tokens.cardText }]}>{t('scan.retry')}</Text>
          </Pressable>
          <Pressable testID="scan-slow-manual" accessibilityRole="button" onPress={onManual} style={[styles.slowButton, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
            <Ionicons name="create-outline" size={18} color={tokens.cardText} /><Text style={[styles.slowButtonText, { color: tokens.cardText }]}>{t('scan.enterManually')}</Text>
          </Pressable>
        </View>
      </View>}
    </View>
    <Pressable onPress={onCancel} accessibilityRole="button" style={styles.cancel}>
      <Text style={[styles.cancelText, { color: tokens.mutedText }]}>{t('scan.cancel')}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: spacing.space6, width: '100%', maxWidth: 568, alignSelf: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.space2 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.space5 },
  status: { ...typography.sectionTitle, textAlign: 'center' },
  slow: { alignSelf: 'stretch', borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space4, gap: spacing.space2 },
  slowTitle: { ...typography.body, fontWeight: '700' },
  slowBody: { ...typography.label, fontWeight: '500', lineHeight: 18 },
  slowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2, marginTop: spacing.space2 },
  slowButton: { minHeight: 44, flexGrow: 1, borderWidth: 1, borderRadius: radius.radiusFull, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2, paddingHorizontal: spacing.space4 },
  slowButtonText: { ...typography.label, fontSize: 14 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...typography.body, fontWeight: '600' },
});
