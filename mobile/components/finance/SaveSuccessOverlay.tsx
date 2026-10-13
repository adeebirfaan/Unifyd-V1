import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FinanceNumber } from '@/components/FinanceNumber';
import { SWIPE_THUMB } from '@/components/finance/SwipeToSave';
import type { SwipeOrigin } from '@/components/finance/SwipeToSave';
import { spacing, typography } from '@/constants/theme';
import { coverRadius } from '@/lib/swipeToSave';
import { useAppearance } from '@/providers/AppearanceProvider';

const nativeDriver = Platform.OS !== 'web';
export type OverlayPhase = 'saving' | 'success' | 'failed';

/**
 * The shared full-screen Unifyd blue-to-cyan gradient step (the Home overview card's `brandGradient`, same diagonal)
 * after a completed swipe-to-save (or tap-to-save). Used by Add subscription and Manage budget.
 * - `saving`: the gradient grows as a circle from the slider's thumb to cover the screen, then a spinner shows while
 *   the save is pending. Nothing says "saved" until the caller confirms the save (`phase: 'success'`).
 * - `success` (minimal): a checkmark, the title, the amount in the finance font, then the caller's `details`.
 *   It stays until the student taps anywhere, or the small continue button.
 * - `failed`: the circle shrinks back into the thumb, then `onHidden` restores the form. No checkmark is shown.
 * Reduce Motion skips the circle: the screen appears and leaves at once.
 * All text uses the near-black action ink (passed to `details`): at least 4.8:1 across the whole gradient, where
 * white would fall to about 2:1 on the cyan end.
 */
export function SaveSuccessOverlay({ testIDPrefix, phase, origin, reduceMotion, savingLabel, title, amount, announcement, continueLabel, details, onContinue, onHidden }: {
  testIDPrefix: string; phase: OverlayPhase; origin: SwipeOrigin | null; reduceMotion: boolean;
  savingLabel: string; title: string; amount: string; announcement: string; continueLabel: string;
  details?: (ink: string) => ReactNode; onContinue: () => void; onHidden: () => void;
}) {
  const { tokens } = useAppearance();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const centre = origin ?? { x: width / 2, y: height - insets.bottom - 80 };
  const reach = coverRadius(centre.x, centre.y, width, height);
  const [reveal] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [check] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [shown] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [grown, setGrown] = useState(false);
  // Reduce Motion can be learned after mount, so it always wins over animation state.
  const covered = grown || reduceMotion;
  const ink = tokens.actionInk;

  // Grow from the thumb once, when the overlay first appears.
  useEffect(() => {
    if (reduceMotion) { reveal.setValue(1); return; }
    const grow = Animated.timing(reveal, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver });
    grow.start(({ finished }) => { if (finished) setGrown(true); });
    return () => grow.stop();
  }, [reveal, reduceMotion]);

  // Announced once, from the latest text, when the confirmed success first shows.
  const latestAnnouncement = useRef(announcement);
  useEffect(() => { latestAnnouncement.current = announcement; });

  useEffect(() => {
    if (phase !== 'success' || !covered) return;
    AccessibilityInfo.announceForAccessibility(latestAnnouncement.current);
    if (reduceMotion) return;
    const show = Animated.sequence([
      Animated.spring(check, { toValue: 1, useNativeDriver: nativeDriver, bounciness: 10, speed: 12 }),
      Animated.timing(shown, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }),
    ]);
    show.start();
    return () => show.stop();
  }, [phase, covered, check, shown, reduceMotion]);

  useEffect(() => {
    if (phase !== 'failed') return;
    if (reduceMotion) { onHidden(); return; }
    const shrink = Animated.timing(reveal, { toValue: 0, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: nativeDriver });
    shrink.start(() => onHidden());
    return () => shrink.stop();
  }, [phase, reveal, reduceMotion, onHidden]);

  const scale = reveal.interpolate({ inputRange: [0, 1], outputRange: [SWIPE_THUMB / (reach * 2), 1] });
  const rise = reduceMotion ? 0 : shown.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const checkIn = reduceMotion ? 1 : check;
  const detailsIn = reduceMotion ? 1 : shown;
  const success = phase === 'success';

  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => { if (success) onContinue(); }}>
    <View style={StyleSheet.absoluteFill} testID={`${testIDPrefix}-saved-overlay`}>
      {/* The gradient fills the whole circle; its end points are the screen's corners in circle terms, so once grown it
          matches the Home overview card's top-left → bottom-right diagonal across the screen. */}
      <Animated.View pointerEvents="none" style={[styles.circle, { left: centre.x - reach, top: centre.y - reach, width: reach * 2, height: reach * 2, borderRadius: reach, backgroundColor: tokens.brandBlue, transform: [{ scale }] }]}>
        <LinearGradient colors={tokens.brandGradient} style={StyleSheet.absoluteFill}
          start={{ x: (reach - centre.x) / (reach * 2), y: (reach - centre.y) / (reach * 2) }} end={{ x: (reach - centre.x + width) / (reach * 2), y: (reach - centre.y + height) / (reach * 2) }} />
      </Animated.View>
      {/* Taps anywhere continue once saved; the button below is the labelled way for screen readers and keyboards. */}
      <Pressable accessible={false} disabled={!success} onPress={onContinue} style={[styles.content, { paddingTop: insets.top + spacing.space8, paddingBottom: insets.bottom + spacing.space6 }]}>
        {phase === 'saving' && covered && <View testID={`${testIDPrefix}-overlay-saving`} style={styles.centre} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={ink} />
          <Text style={[styles.status, { color: ink }]}>{savingLabel}</Text>
        </View>}
        {success && covered && <>
          <View testID={`${testIDPrefix}-overlay-success`} style={[styles.centre, styles.lifted]}>
            <Animated.View style={{ opacity: checkIn, transform: [{ scale: reduceMotion ? 1 : check.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }}>
              <Ionicons name="checkmark" size={64} color={ink} />
            </Animated.View>
            <Animated.View style={[styles.centre, { opacity: detailsIn, transform: [{ translateY: rise }] }]}>
              <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>{title}</Text>
              <FinanceNumber fit style={[styles.amount, { color: ink }]}>{amount}</FinanceNumber>
              {details?.(ink)}
            </Animated.View>
          </View>
          <Animated.View style={[styles.continueWrap, { bottom: insets.bottom + spacing.space4, opacity: detailsIn }]}>
            <Pressable accessibilityRole="button" onPress={onContinue} style={styles.continue}>
              <Text style={[styles.continueText, { color: ink }]}>{continueLabel}</Text>
            </Pressable>
          </Animated.View>
        </>}
      </Pressable>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  circle: { position: 'absolute', overflow: 'hidden' },
  content: { flex: 1, paddingHorizontal: spacing.space6, justifyContent: 'center' },
  centre: { alignItems: 'center', gap: spacing.space2, width: '100%', maxWidth: 420, alignSelf: 'center' },
  status: { ...typography.body, fontWeight: '600' },
  // A bottom margin of 48 lifts the centred success block by 24 pt, so it reads as centred above the bottom prompt.
  lifted: { marginBottom: spacing.space8 + spacing.space4 },
  title: { ...typography.body, fontWeight: '600', textAlign: 'center', marginTop: spacing.space2 },
  amount: { fontSize: 44, alignSelf: 'stretch', textAlign: 'center' },
  continueWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  continue: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.space6 },
  continueText: { ...typography.label, fontWeight: '500' },
});
