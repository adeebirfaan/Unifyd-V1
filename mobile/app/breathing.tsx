import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { BREATH_IN_MS, BREATH_OUT_MS, breathStep } from '@/lib/breathing';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type Run = { status: 'ready' } | { status: 'running'; startedAt: number; now: number } | { status: 'done' };

const CIRCLE = 220;
const SMALL = 0.55; // circle scale at the end of breathing out
const TICK_MS = 200;
const nativeDriver = Platform.OS !== 'web';

// Wellbeing Phase 2 (SRS-FR-1102): an optional one-minute breathing break. A pause, not treatment.
// Time comes from one start timestamp (lib/breathing.ts); ticks only redraw. Nothing is saved or sent.
export default function BreathingScreen() {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [run, setRun] = useState<Run>({ status: 'ready' });
  const [scale] = useState(() => new Animated.Value(SMALL));

  const step = run.status === 'running' ? breathStep(run.now - run.startedAt) : null;
  const phase = step && !step.done ? step.phase : null;
  const phaseKey = step && !step.done ? `${step.cycle}-${step.phase}` : null;

  useEffect(() => {
    if (run.status !== 'running') return;
    const timer = setInterval(() => {
      const time = Date.now();
      setRun((previous) => {
        if (previous.status !== 'running') return previous;
        return breathStep(time - previous.startedAt).done ? { status: 'done' } : { ...previous, now: time };
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [run.status]);

  // One grow or shrink per phase. Under Reduce Motion the circle stays still and the text guides.
  useEffect(() => {
    if (!phaseKey || !phase) return;
    if (reduceMotion) { scale.stopAnimation(); scale.setValue(0.8); return; }
    const animation = Animated.timing(scale, { toValue: phase === 'in' ? 1 : SMALL, duration: phase === 'in' ? BREATH_IN_MS : BREATH_OUT_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver });
    animation.start();
    return () => animation.stop();
  }, [phaseKey, phase, reduceMotion, scale]);

  useEffect(() => {
    if (phase) AccessibilityInfo.announceForAccessibility(t(phase === 'in' ? 'wellbeing.breathe.in' : 'wellbeing.breathe.out'));
  }, [phaseKey, phase, t]);

  function start() {
    const time = Date.now();
    scale.setValue(SMALL);
    setRun({ status: 'running', startedAt: time, now: time });
  }

  function stop() {
    scale.stopAnimation();
    scale.setValue(SMALL);
    setRun({ status: 'ready' });
  }

  const phaseText = phase ? t(phase === 'in' ? 'wellbeing.breathe.in' : 'wellbeing.breathe.out') : null;
  const seconds = step && !step.done ? step.secondsLeft : null;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={tokens.screenText} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: tokens.screenText }]}>{t('wellbeing.breathe.title')}</Text>
      <Text style={[styles.intro, { color: tokens.mutedText }]}>{t(run.status === 'done' ? 'wellbeing.breathe.doneBody' : 'wellbeing.breathe.intro')}</Text>

      <View style={styles.stage}>
        <View style={styles.circleBox}>
          <Animated.View testID="breathing-circle" style={[styles.circle, { backgroundColor: tokens.brandCyan, transform: [{ scale }] }]} />
          <View style={styles.circleCenter} pointerEvents="none">
            {run.status === 'done'
              ? <Ionicons name="checkmark" size={44} color={tokens.screenText} />
              : seconds !== null && <Text style={[styles.count, { color: tokens.screenText }]} importantForAccessibility="no" accessibilityElementsHidden>{seconds}</Text>}
          </View>
        </View>
        <Text testID="breathing-phase" accessibilityLiveRegion="polite" style={[styles.phase, { color: tokens.screenText }]}>
          {run.status === 'done' ? t('wellbeing.breathe.doneTitle') : phaseText ?? ' '}
        </Text>
      </View>

      {run.status === 'running'
        ? <Pressable testID="breathing-stop" accessibilityRole="button" onPress={stop} style={({ pressed }) => [styles.button, styles.secondary, { borderColor: tokens.border, backgroundColor: tokens.cardBackground }, pressed && styles.pressed]}>
            <Text style={[styles.buttonText, { color: tokens.cardText }]}>{t('wellbeing.breathe.stop')}</Text>
          </Pressable>
        : <Pressable testID="breathing-start" accessibilityRole="button" onPress={start} style={({ pressed }) => [styles.button, { backgroundColor: tokens.brandBlue }, pressed && styles.pressed]}>
            <Text style={[styles.buttonText, { color: colors.white }]}>{t(run.status === 'done' ? 'wellbeing.breathe.again' : 'wellbeing.breathe.start')}</Text>
          </Pressable>}
      <Text style={[styles.note, { color: tokens.mutedText }]}>{t('wellbeing.breathe.note')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.space3, marginBottom: spacing.space3 },
  title: { ...typography.screenTitle },
  intro: { ...typography.body, lineHeight: 23, marginTop: spacing.space2 },
  stage: { alignItems: 'center', marginVertical: spacing.space8, gap: spacing.space6 },
  circleBox: { width: CIRCLE, height: CIRCLE, alignItems: 'center', justifyContent: 'center' },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, opacity: 0.22 },
  circleCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  count: { ...typography.display },
  phase: { ...typography.sectionTitle, minHeight: 28 },
  button: { minHeight: 56, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.space5 },
  secondary: { borderWidth: 1 },
  buttonText: { ...typography.body, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  note: { ...typography.label, lineHeight: 18, marginTop: spacing.space4, textAlign: 'center' },
});
