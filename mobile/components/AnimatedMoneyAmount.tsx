import { useLayoutEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, TextStyle } from 'react-native';

import { ADVANCE, FinanceNumber, LETTER_SPACING, LINE_HEIGHT, MIN_SCALE } from '@/components/FinanceNumber';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { amountDigits, rollColumns } from '@/lib/moneyRoll';

const DURATION = 850;
const PREFIX = 'RM ';
// The last amount shown for each key in this app session, so a screen that remounts (for example
// Wallet reloading on focus) rolls from what the student last saw, and an unchanged total never replays.
const lastShown = new Map<string, number>();

/**
 * A finance amount whose digits roll down into place, like an odometer: each changed digit drops in
 * from above through the digits in between. Only the digits move; "RM", separators that stay put, the
 * container, and its size are static, because every glyph has the same fixed width. Reduced motion
 * shows the final value at once. Screen readers get one label with the final value, never the motion.
 */
export function AnimatedMoneyAmount({ cents, memoryKey, accessibilityLabel, style, testID, play = true, replayOnShow = false }: {
  cents: number; memoryKey: string; accessibilityLabel: string; style?: StyleProp<TextStyle>; testID?: string;
  /** False while the amount is off screen: the digits wait on the previous value and roll once shown. */
  play?: boolean;
  /** Roll again from RM 0.00 each time `play` turns back on, even when the value has not changed. */
  replayOnShow?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const { fontSize: baseSize = 16, color } = StyleSheet.flatten(style) ?? {};
  // First load in a session rolls from RM 0.00. A new target replaces the running roll and starts
  // from the previous target, so rapid refreshes never stack animations.
  const [roll, setRoll] = useState(() => ({ from: lastShown.get(memoryKey) ?? 0, to: cents }));
  if (roll.to !== cents) setRoll({ from: roll.to, to: cents });
  const [wasPlaying, setWasPlaying] = useState(play);
  if (play !== wasPlaying) {
    setWasPlaying(play);
    if (play && replayOnShow) setRoll({ from: 0, to: cents });
  }
  const [progress] = useState(() => new Animated.Value(roll.from === roll.to ? 1 : 0));
  const [width, setWidth] = useState<number | null>(null);
  // Once a roll has been allowed to start it is latched, so scrolling away mid-roll never resets it.
  const [startedRoll, setStartedRoll] = useState<typeof roll | null>(play ? roll : null);
  if (play && startedRoll !== roll) setStartedRoll(roll);
  const started = startedRoll === roll;
  // After a roll the columns collapse back into one plain text run with the same size and position.
  const [settledRoll, setSettledRoll] = useState<typeof roll | null>(null);
  const settled = roll.from === roll.to || reduceMotion || settledRoll === roll;

  // A layout effect positions the columns before paint, so the new value never flashes first.
  useLayoutEffect(() => {
    if (roll.from === roll.to || reduceMotion) { lastShown.set(memoryKey, roll.to); progress.setValue(1); return; }
    progress.setValue(0);
    // Not yet seen: hold on the previous value, and remember nothing, so the roll still plays when shown.
    if (!started) return;
    lastShown.set(memoryKey, roll.to);
    const animation = Animated.timing(progress, { toValue: 1, duration: DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start(({ finished }) => { if (finished) setSettledRoll(roll); });
    return () => animation.stop();
  }, [roll, started, reduceMotion, memoryKey, progress]);

  const target = amountDigits(roll.to);
  const columns = rollColumns(amountDigits(roll.from), target, roll.to >= roll.from);
  // Shrink large amounts to the available width, as FinanceNumber's `fit` does, instead of clipping.
  const chars = PREFIX.length + target.length;
  const fitted = width ? ((width / chars - LETTER_SPACING) / ADVANCE) * 0.97 : baseSize;
  const size = Math.max(baseSize * MIN_SCALE, Math.min(baseSize, fitted));
  const cell = ADVANCE * size + LETTER_SPACING;
  const height = Math.round(size * LINE_HEIGHT);
  const glyph = { fontSize: size, lineHeight: height, color, width: cell, textAlign: 'center' as const };

  return <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel} style={styles.row}
    onLayout={(event: LayoutChangeEvent) => { const next = event.nativeEvent.layout.width; if (next !== width) setWidth(next); }}>
    <View testID={testID && `${testID}-glyphs`} style={[styles.glyphs, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {settled ? <FinanceNumber style={{ fontSize: size, lineHeight: height, color }}>{PREFIX + target}</FinanceNumber> : <>
      <FinanceNumber style={{ fontSize: size, lineHeight: height, color }}>{PREFIX}</FinanceNumber>
      {columns.map((sequence, index) => {
        const key = `${target.length - index}`;
        if (sequence.length === 1) return <FinanceNumber key={key} style={glyph}>{sequence[0]}</FinanceNumber>;
        // The column is stacked target-first; sliding it down reveals each next digit from above.
        const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-(sequence.length - 1) * height, 0] });
        return <View key={key} testID={testID && `${testID}-roll`} style={[styles.window, { width: cell, height }]}>
          <Animated.View style={{ transform: [{ translateY }] }}>
            {[...sequence].reverse().map((char, position) => <FinanceNumber key={position} style={glyph}>{char}</FinanceNumber>)}
          </Animated.View>
        </View>;
      })}
      </>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  row: { alignSelf: 'stretch' },
  glyphs: { flexDirection: 'row', alignItems: 'flex-start' },
  window: { overflow: 'hidden' },
});
