import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAppearance } from '@/providers/AppearanceProvider';

const nativeDriver = Platform.OS !== 'web';
/** A short success line is readable in 2.5 s; a second line (a reminder notice) gets 4 s. */
export const TOAST_MS = 2500;
export const TOAST_DETAIL_MS = 4000;

export type ToastMessage = { id: number; text: string; detail?: string; detailLabel?: string };

/**
 * A brief success toast that slides down over the top of the screen, then leaves by itself. It never moves the
 * page content. Tapping it dismisses it at once. It is announced to screen readers. Under Reduce Motion it
 * appears and leaves without moving. Only for success: errors stay on the page until they are dealt with.
 * Used by Subscriptions and, for "Budget saved.", by Wallet.
 */
export function FinanceToast({ toast, onDone, testID = 'subscriptions-toast' }: { toast: ToastMessage | null; onDone: () => void; testID?: string }) {
  const { tokens } = useAppearance();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(0));
  const latestDone = useRef(onDone);
  useEffect(() => { latestDone.current = onDone; });

  useEffect(() => {
    if (!toast) return;
    AccessibilityInfo.announceForAccessibility(toast.detailLabel ? `${toast.text} ${toast.detailLabel}` : toast.text);
    const move = (toValue: number, duration: number) => reduceMotion
      ? Animated.timing(shown, { toValue, duration: 0, useNativeDriver: nativeDriver })
      : Animated.timing(shown, { toValue, duration, easing: toValue ? Easing.out(Easing.back(1.4)) : Easing.in(Easing.cubic), useNativeDriver: nativeDriver });
    shown.setValue(0);
    const enter = move(1, 260);
    enter.start();
    let exit: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      exit = move(0, 200);
      exit.start(({ finished }) => { if (finished) latestDone.current(); });
    }, toast.detail ? TOAST_DETAIL_MS : TOAST_MS);
    return () => { clearTimeout(timer); enter.stop(); exit?.stop(); };
  }, [toast, shown, reduceMotion]);

  if (!toast) return null;
  const translateY = reduceMotion ? 0 : shown.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  return <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + spacing.space2 }]}>
    <Animated.View style={{ opacity: shown, transform: [{ translateY }] }}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLiveRegion="polite"
        accessibilityLabel={toast.detailLabel ? `${toast.text} ${toast.detailLabel}` : toast.text} onPress={onDone}
        style={[styles.toast, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
        {/* Fixed green with dark ink (≈ 8:1); the toast is dark in both themes. */}
        <View style={[styles.badge, { backgroundColor: colors.success }]}><Ionicons name="checkmark" size={18} color={tokens.actionInk} /></View>
        <View style={styles.copy}>
          <Text style={[styles.text, { color: tokens.cardText }]} numberOfLines={2}>{toast.text}</Text>
          {toast.detail && <Text style={[styles.detail, { color: tokens.cardMutedText }]} numberOfLines={2}>{toast.detail}</Text>}
        </View>
      </Pressable>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: spacing.space4, right: spacing.space4, alignItems: 'center', zIndex: 10 },
  toast: {
    minHeight: 52, maxWidth: 480, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, borderWidth: 1, borderRadius: radius.radiusFull,
    paddingLeft: spacing.space2, paddingRight: spacing.space5, paddingVertical: spacing.space2,
    shadowColor: colors.black, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  copy: { flexShrink: 1, gap: 2 },
  text: { ...typography.body, fontWeight: '700' },
  detail: { ...typography.label, fontWeight: '500' },
});
