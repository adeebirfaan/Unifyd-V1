import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { spacing, typography } from '@/constants/theme';
import type { TranslationKey } from '@/constants/i18n';
import { elapsedMs, formatFocusClock, remainingMs, roundNumber } from '@/lib/focusTimer';
import type { FocusState } from '@/lib/focusTimer';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const STROKE = 10;
const TICK_MS = 250;

export function focusPhaseKey(state: FocusState): TranslationKey {
  if (state.status === 'paused') return 'focus.phasePaused';
  if (state.status === 'idle') return 'focus.phaseReady';
  return state.phase === 'focus' ? 'focus.phaseFocus' : state.phase === 'shortBreak' ? 'focus.phaseShortBreak' : 'focus.phaseLongBreak';
}

/**
 * The countdown ring. The time is always worked out from the timer's timestamps; the interval only redraws, and
 * only while running. It re-renders once per displayed second (unchanged seconds are skipped), and nothing else on
 * the screen re-renders with it. When the phase runs out it calls `onExpire` so the screen applies the change.
 * No animation: the ring steps once a second, so Reduce Motion needs nothing different.
 */
export function FocusDial({ state, at, size, onExpire }: { state: FocusState; at: number; size: number; onExpire: () => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  // The latest tick, tied to the state it measured; a newer state starts from the time it was taken.
  const [tick, setTick] = useState<{ state: FocusState; now: number } | null>(null);
  const now = tick && tick.state === state ? Math.max(tick.now, at) : at;

  useEffect(() => {
    if (state.status !== 'running') return;
    let expired = false;
    const timer = setInterval(() => {
      const time = Date.now();
      setTick((previous) => previous && previous.state === state
        && Math.ceil(remainingMs(state, previous.now) / 1000) === Math.ceil(remainingMs(state, time) / 1000) ? previous : { state, now: time });
      if (!expired && remainingMs(state, time) <= 0) { expired = true; onExpire(); }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [state, onExpire]);

  const left = remainingMs(state, now);
  const progress = state.phaseMs ? elapsedMs(state, now) / state.phaseMs : 0;
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const phase = t(focusPhaseKey(state));
  const round = roundNumber(state) || 1;
  const minutesLeft = t('focus.minutes', { count: Math.ceil(left / 60_000) });
  const breakPhase = state.phase !== 'focus';

  return <View testID="focus-dial" accessible accessibilityRole="timer" accessibilityLabel={t('focus.dialA11y', { phase, round, time: minutesLeft })}
    style={[styles.dial, { width: size, height: size }]}>
    <Svg width={size} height={size} style={styles.ring}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={tokens.cardElevated} strokeWidth={STROKE} fill="none" />
      {progress > 0 && <Circle cx={size / 2} cy={size / 2} r={radius} stroke={breakPhase ? tokens.brandBlue : tokens.brandCyan} strokeWidth={STROKE} fill="none"
        strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - progress)} />}
    </Svg>
    <View style={styles.center} importantForAccessibility="no-hide-descendants">
      {/* Large system text is honoured up to 1.2×, so the digits always fit inside the ring. */}
      <Text testID="focus-phase" maxFontSizeMultiplier={1.2} style={[styles.phase, { color: breakPhase ? tokens.cardText : tokens.brandCyan }]}>{phase}</Text>
      <Text testID="focus-time" maxFontSizeMultiplier={1.2} style={[styles.time, { color: tokens.cardText, fontSize: size >= 240 ? 52 : 44 }]}>{formatFocusClock(left)}</Text>
      <Text testID="focus-round" maxFontSizeMultiplier={1.2} style={[styles.round, { color: tokens.cardMutedText }]}>{t('focus.round', { round })}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  dial: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  // Start the progress at twelve o'clock and fill clockwise.
  ring: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  center: { alignItems: 'center', gap: spacing.space1 },
  phase: { ...typography.label, letterSpacing: 1.5, textTransform: 'uppercase' },
  time: { fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  round: { ...typography.label },
});
