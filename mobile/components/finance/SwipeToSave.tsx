import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { isHorizontalSwipe, swipeCompletes, swipePosition, swipeTravel } from '@/lib/swipeToSave';
import { useAppearance } from '@/providers/AppearanceProvider';

export const SWIPE_THUMB = 52;
const INSET = 4;
const BORDER = 1;

export type SwipeOrigin = { x: number; y: number };

/**
 * A rounded track with a round blue thumb that is dragged left to right to save. The track fills with blue as
 * the thumb moves and the label fades. Releasing before 90% of the travel springs the thumb back; reaching the
 * end (or releasing past 90%) calls `onComplete` once, with the thumb's centre on screen so the next step can
 * grow from it. The control then stays locked at the end until `resetKey` changes, so repeated gestures can
 * never save twice.
 *
 * Only a clearly sideways drag moves the thumb. A vertical move is handed to the page's scroll view, so
 * scrolling never drags or saves anything. The slider is hidden from screen readers because the screen always
 * shows a tap-to-save button that runs the same handler; swiping is never the only way to save.
 */
export function SwipeToSave({ label, onComplete, disabled = false, resetKey, testID }: {
  label: string; onComplete: (origin: SwipeOrigin | null) => void; disabled?: boolean; resetKey: number; testID?: string;
}) {
  const { tokens } = useAppearance();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [position] = useState(() => new Animated.Value(0));
  const thumb = useRef<View>(null);
  // The track's 1 pt border sits outside the thumb's travel.
  const travel = swipeTravel(width - BORDER * 2, SWIPE_THUMB, INSET);
  // Latest props for the touch handlers and animation callbacks.
  const latest = useRef({ travel, disabled, reduceMotion, onComplete });
  const locked = useRef(false);
  const dragging = useRef(false);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  // Where the current touch began; the thumb follows the horizontal distance from it.
  const start = useRef({ x: 0, y: 0 });

  useEffect(() => { latest.current = { travel, disabled, reduceMotion, onComplete }; });

  // A new `resetKey` (a failed or invalid save) unlocks the control and returns the thumb to the start.
  useEffect(() => {
    locked.current = false;
    animation.current?.stop();
    if (latest.current.reduceMotion) { position.setValue(0); return; }
    animation.current = Animated.spring(position, { toValue: 0, useNativeDriver: false, bounciness: 4, speed: 14 });
    animation.current.start();
  }, [resetKey, position]);

  useEffect(() => () => animation.current?.stop(), []);

  // Plain responder props rather than PanResponder, so these touch handlers stay ordinary event handlers.
  function settle(toValue: number) {
    animation.current?.stop();
    if (latest.current.reduceMotion) { position.setValue(toValue); return; }
    animation.current = toValue === 0
      ? Animated.spring(position, { toValue, useNativeDriver: false, bounciness: 6, speed: 16 })
      : Animated.timing(position, { toValue, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.current.start();
  }
  function complete() {
    if (locked.current) return;
    locked.current = true;
    dragging.current = false;
    settle(latest.current.travel);
    const done = latest.current.onComplete;
    if (thumb.current?.measureInWindow) thumb.current.measureInWindow((x, y, w, h) => done(Number.isFinite(x) && w > 0 ? { x: x + w / 2, y: y + h / 2 } : null));
    else done(null);
  }
  const canStart = () => !locked.current && !latest.current.disabled && latest.current.travel > 0;
  const offset = (event: GestureResponderEvent) => ({ dx: event.nativeEvent.pageX - start.current.x, dy: event.nativeEvent.pageY - start.current.y });

  const end = Math.max(travel, 1);
  const fillWidth = position.interpolate({ inputRange: [0, end], outputRange: [SWIPE_THUMB + INSET * 2, end + SWIPE_THUMB + INSET * 2], extrapolate: 'clamp' });
  const fillOpacity = position.interpolate({ inputRange: [0, end], outputRange: [0.28, 1], extrapolate: 'clamp' });
  const labelOpacity = position.interpolate({ inputRange: [0, end * 0.55], outputRange: [1, 0], extrapolate: 'clamp' });

  return <View testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden
    onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
    style={[styles.track, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }, disabled && styles.disabled]}>
    <Animated.View pointerEvents="none" style={[styles.fill, { width: fillWidth, opacity: fillOpacity, backgroundColor: tokens.brandBlue }]} />
    <Animated.Text pointerEvents="none" numberOfLines={1} style={[styles.label, { color: tokens.cardText, opacity: labelOpacity }]}>{label}</Animated.Text>
    <Animated.View ref={thumb} testID={testID ? `${testID}-thumb` : undefined}
      onStartShouldSetResponder={(event) => {
        if (!canStart()) return false;
        start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
        animation.current?.stop();
        dragging.current = false;
        return true;
      }}
      onResponderMove={(event) => {
        if (locked.current) return;
        const { dx, dy } = offset(event);
        if (!dragging.current) {
          if (!isHorizontalSwipe(dx, dy)) return;
          dragging.current = true;
        }
        const x = swipePosition(dx, latest.current.travel);
        position.setValue(x);
        if (x >= latest.current.travel) complete();
      }}
      onResponderRelease={(event) => {
        if (locked.current) return;
        const wasDragging = dragging.current;
        dragging.current = false;
        if (wasDragging && swipeCompletes(swipePosition(offset(event).dx, latest.current.travel), latest.current.travel)) complete();
        else settle(0);
      }}
      // Losing the touch to the scroll view (a vertical move) or the system never saves.
      onResponderTerminate={() => { dragging.current = false; if (!locked.current) settle(0); }}
      // Once the thumb is moving sideways it keeps the touch; before that, a vertical scroll may take it.
      onResponderTerminationRequest={() => !dragging.current}
      style={[styles.thumb, { backgroundColor: tokens.brandBlue, transform: [{ translateX: position }] }]}>
      <Ionicons name="arrow-forward" size={24} color={colors.white} />
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  track: { height: SWIPE_THUMB + INSET * 2 + BORDER * 2, borderRadius: radius.radiusFull, borderWidth: BORDER, justifyContent: 'center', overflow: 'hidden', userSelect: 'none' },
  disabled: { opacity: 0.6 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.radiusFull },
  label: { ...typography.body, fontWeight: '700', position: 'absolute', left: SWIPE_THUMB + spacing.space4, right: spacing.space4, textAlign: 'center' },
  thumb: { position: 'absolute', left: INSET, width: SWIPE_THUMB, height: SWIPE_THUMB, borderRadius: SWIPE_THUMB / 2, alignItems: 'center', justifyContent: 'center' },
});
