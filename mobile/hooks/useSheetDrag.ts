import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, PanResponderGestureState } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';

const CLOSE_DISTANCE = 96;
const CLOSE_VELOCITY = 1;
const nativeDriver = Platform.OS !== 'web';

/**
 * Drag-to-close for the app's bottom sheets (Modal, ShadePicker pattern). The sheet follows the finger from
 * its header, or from its list when that list is scrolled to the top. Releasing after 96 pt, or a quick
 * downward flick, closes it at once (the modal's own slide-out finishes the motion); otherwise it eases back,
 * or snaps back under Reduce Motion.
 *
 * Each opening gets a brand-new drag value and a new `opening` key for the sheet view. Resetting the old value
 * instead could be lost on phones after a drag-close, leaving the sheet off-screen behind the dimmed backdrop.
 */
export function useSheetDrag(visible: boolean, onClose: () => void) {
  const reduceMotion = useReducedMotion();
  const [opening, setOpening] = useState(0);
  const [offset, setOffset] = useState(() => new Animated.Value(0));
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) { setOpening((count) => count + 1); setOffset(new Animated.Value(0)); }
  }
  // Whether the sheet's list is scrolled to its top, so a downward drag there pulls the sheet instead of scrolling.
  const listAtTop = useRef(true);
  useLayoutEffect(() => { if (visible) listAtTop.current = true; }, [visible]);

  const { headerDrag, listDrag } = useMemo(() => {
    const follow = (_event: unknown, gesture: PanResponderGestureState) => offset.setValue(Math.max(0, gesture.dy));
    const finish = (_event: unknown, gesture: PanResponderGestureState) => {
      if (gesture.dy > CLOSE_DISTANCE || (gesture.dy > 24 && gesture.vy > CLOSE_VELOCITY)) onClose();
      else if (reduceMotion) offset.setValue(0);
      else Animated.timing(offset, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
    };
    const shared = { onPanResponderMove: follow, onPanResponderRelease: finish, onPanResponderTerminate: finish, onPanResponderTerminationRequest: () => false };
    return {
      // The header claims the touch at once; buttons inside it still receive their own taps first.
      headerDrag: PanResponder.create({ onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, ...shared }),
      // From a list, only a clearly downward drag while it is at the top takes over from scrolling.
      listDrag: PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_event, gesture) => listAtTop.current && gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
        ...shared,
      }),
    };
  }, [offset, onClose, reduceMotion]);

  const onListScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => { listAtTop.current = event.nativeEvent.contentOffset.y <= 0; };
  return { opening, offset, reduceMotion, headerHandlers: headerDrag.panHandlers, listHandlers: listDrag.panHandlers, onListScroll };
}
