import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { useAppearance } from '@/providers/AppearanceProvider';

const SIZE = 160;
const useNative = Platform.OS !== 'web';
// Three opacity rhythms shared by all dots (staggered by dot), so 66 dots need only five animated values.
const PULSES = [1600, 2000, 2400];

type Dot = { x: number; y: number; size: number; pulse: number; cyan: boolean };

/** A fixed pseudo-random scatter (the same every time), so the ring looks hand-placed rather than mechanical. */
function band(count: number, radius: number, seed: number): Dot[] {
  let state = seed;
  const random = () => { state = (state * 16807) % 2147483647; return state / 2147483647; };
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (random() - 0.5) * 0.35;
    const distance = radius + (random() - 0.5) * 14;
    return {
      x: SIZE / 2 + Math.cos(angle) * distance, y: SIZE / 2 + Math.sin(angle) * distance,
      size: 3 + Math.round(random() * 2), pulse: index % PULSES.length, cyan: random() > 0.45,
    };
  });
}

/**
 * The Reading step's dotted ring: two loose bands of small brand-blue and cyan dots drifting around one circle.
 * The outer band turns clockwise (6 s), the inner band counter-clockwise (9 s), and the dots fade between 0.5 and 1.
 * Transform and opacity only, on the native driver (like PoofMascot). Reduce Motion draws it once, still.
 * Decorative: hidden from screen readers (the status text beside it is announced).
 */
export function ReceiptReadingRing({ reduceMotion }: { reduceMotion: boolean }) {
  const { tokens } = useAppearance();
  const outer = useMemo(() => band(40, 66, 7), []);
  const inner = useMemo(() => band(26, 48, 13), []);
  const [spinOuter] = useState(() => new Animated.Value(0));
  const [spinInner] = useState(() => new Animated.Value(0));
  const [pulses] = useState(() => PULSES.map(() => new Animated.Value(1)));

  useEffect(() => {
    if (reduceMotion) {
      spinOuter.setValue(0); spinInner.setValue(0); pulses.forEach((pulse) => pulse.setValue(1));
      return;
    }
    const spin = (value: Animated.Value, duration: number) => Animated.loop(Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: useNative }));
    const fade = (value: Animated.Value, duration: number) => Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 0.5, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
      Animated.timing(value, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
    ]));
    const loops = [spin(spinOuter, 6000), spin(spinInner, 9000), ...pulses.map((pulse, index) => fade(pulse, PULSES[index]!))];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [reduceMotion, spinOuter, spinInner, pulses]);

  const rotate = (value: Animated.Value, clockwise: boolean) => value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', clockwise ? '360deg' : '-360deg'] });
  const dots = (list: Dot[]) => list.map((dot, index) => <Animated.View key={index} style={[styles.dot, {
    left: dot.x - dot.size / 2, top: dot.y - dot.size / 2, width: dot.size, height: dot.size, borderRadius: dot.size / 2,
    backgroundColor: dot.cyan ? tokens.brandCyan : tokens.brandBlue, opacity: pulses[dot.pulse],
  }]} />);
  const motion = { dataSet: { motion: reduceMotion ? 'static' : 'animated' } } as object;

  return <View testID="scan-ring" {...motion} style={styles.ring} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: rotate(spinOuter, true) }] }]}>{dots(outer)}</Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: rotate(spinInner, false) }] }]}>{dots(inner)}</Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  ring: { width: SIZE, height: SIZE },
  dot: { position: 'absolute' },
});
