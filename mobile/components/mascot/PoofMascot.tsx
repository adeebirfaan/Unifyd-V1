import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

// Poof, Unifyd's mascot: one approved, locally bundled image (resized copy of the
// approved artwork). It is only moved, scaled, and tilted; never redrawn or recoloured.
export const POOF_IMAGE = require('../../assets/mascots/poof/poof.png');
export const POOF_ASPECT = 300 / 240; // width / height of the bundled image

export type PoofVariant = 'idle' | 'welcome' | 'celebrate';
/** `disc`: soft round backdrop. `bubble`: speech-bubble backdrop for the chat launcher. */
export type PoofBackdrop = 'disc' | 'bubble';
type Phase = 'pending' | 'static' | 'welcome' | 'idle' | 'reacting' | 'celebrating';

const useNative = Platform.OS !== 'web';
const IDLE_HALF_MS = 1800; // one float up or down; a full loop is about 3.6 s

// The welcome plays on the first Home visit of each app session only.
let welcomedThisSession = false;

function timing(value: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.quad)) {
  return Animated.timing(value, { toValue, duration, easing, useNativeDriver: useNative });
}

/**
 * Animated Poof, following the mascot storyboard: it pops in and waves on the
 * first visit of a session, floats calmly while its screen is focused, hops and
 * waves when tapped, and can celebrate. With reduced motion it stays still.
 * With `onPress` (the Home chat launcher), a tap plays the reaction and calls
 * `onPress` at once, so the action never waits for the animation.
 */
export function PoofMascot({ variant = 'welcome', size = 56, interactive = true, backdrop = 'disc', onPress, testID = 'poof-mascot', label, hint }: {
  variant?: PoofVariant; size?: number; interactive?: boolean; backdrop?: PoofBackdrop;
  onPress?: () => void; testID?: string; label?: string; hint?: string;
}) {
  const { t } = useI18n();
  const { tokens } = useAppearance();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('pending');
  const [reactions, setReactions] = useState(0);
  const busy = useRef(false);
  const idleLoop = useRef<Animated.CompositeAnimation | null>(null);
  const [values] = useState(() => ({
    idle: new Animated.Value(0), // 0..1 calm float cycle
    entrance: new Animated.Value(1), // 0 hidden and small, 1 fully shown
    hop: new Animated.Value(0), // vertical offset in points (negative is up)
    tilt: new Animated.Value(0), // degrees
    pop: new Animated.Value(1), // extra scale during reactions
  }));

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled); }).catch(() => { if (active) setReduceMotion(false); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  const startIdle = useCallback(() => {
    idleLoop.current?.stop();
    idleLoop.current = Animated.loop(Animated.sequence([
      timing(values.idle, 1, IDLE_HALF_MS, Easing.inOut(Easing.sin)),
      timing(values.idle, 0, IDLE_HALF_MS, Easing.inOut(Easing.sin)),
    ]));
    idleLoop.current.start();
    setPhase('idle');
  }, [values]);

  // A friendly wave: Poof tilts side to side, echoing the storyboard's waving frames.
  const wave = useCallback(() => Animated.sequence([
    timing(values.tilt, -9, 120), timing(values.tilt, 8, 150), timing(values.tilt, -6, 140), timing(values.tilt, 0, 130),
  ]), [values]);

  const hop = useCallback((height: number) => Animated.sequence([
    timing(values.hop, -height, 170, Easing.out(Easing.quad)),
    timing(values.hop, 0, 230, Easing.bounce),
  ]), [values]);

  /** Runs one reaction at a time; extra triggers while one is playing are ignored. */
  const play = useCallback((kind: 'reacting' | 'celebrating', animation: Animated.CompositeAnimation) => {
    if (busy.current) return;
    busy.current = true;
    setReactions((count) => count + 1);
    setPhase(kind);
    animation.start(({ finished }) => {
      busy.current = false;
      if (finished) setPhase('idle');
    });
  }, []);

  useFocusEffect(useCallback(() => {
    if (reduceMotion === null) return undefined;
    if (reduceMotion) {
      // Reduced motion: Poof stays still and fully visible.
      values.entrance.setValue(1);
      setPhase('static');
      return undefined;
    }
    if (variant === 'welcome' && !welcomedThisSession) {
      welcomedThisSession = true;
      busy.current = true;
      setPhase('welcome');
      values.entrance.setValue(0);
      Animated.sequence([
        timing(values.entrance, 1, 460, Easing.out(Easing.back(1.8))),
        Animated.parallel([wave(), hop(6)]),
      ]).start(({ finished }) => {
        busy.current = false;
        if (finished) startIdle();
      });
    } else {
      startIdle();
    }
    return () => {
      // Leaving Home stops every animation and returns Poof to rest.
      idleLoop.current?.stop();
      for (const value of Object.values(values)) value.stopAnimation();
      values.idle.setValue(0);
      values.hop.setValue(0);
      values.tilt.setValue(0);
      values.pop.setValue(1);
      values.entrance.setValue(1);
      busy.current = false;
    };
  }, [reduceMotion, variant, values, wave, hop, startIdle]));

  useEffect(() => {
    // Celebrate only when asked to and when motion is allowed.
    if (variant !== 'celebrate' || reduceMotion !== false) return;
    play('celebrating', Animated.parallel([
      Animated.sequence([hop(12), hop(8)]),
      Animated.sequence([timing(values.pop, 1.08, 200), timing(values.pop, 1, 600)]),
    ]));
  }, [variant, reduceMotion, play, hop, values]);

  function react() {
    if (reduceMotion || phase === 'welcome') return;
    play('reacting', Animated.parallel([hop(10), wave()]));
  }

  function press() {
    react();
    onPress?.();
  }

  const translateY = Animated.add(values.idle.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }), values.hop);
  const rotate = Animated.add(values.idle.interpolate({ inputRange: [0, 1], outputRange: [-1.2, 1.2] }), values.tilt)
    .interpolate({ inputRange: [-30, 30], outputRange: ['-30deg', '30deg'] });
  const scale = Animated.multiply(Animated.multiply(values.idle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }), values.pop),
    values.entrance.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }));
  const opacity = values.entrance.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] });
  // Exposed for tests on the web; has no visual effect.
  const dataSet = { dataSet: { phase, reactions: String(reactions), backdrop } } as object;
  const motion = { opacity, transform: [{ translateY }, { rotate }, { scale }] };
  const bubbleScale = size * 1.5 / (2 * BUBBLE.r);
  const art = <Animated.Image source={POOF_IMAGE} resizeMode="contain" style={{ width: size * POOF_ASPECT, height: size }} />;

  return (
    <Pressable testID={testID} {...dataSet} disabled={!interactive} onPress={press} hitSlop={8}
      accessibilityRole={interactive ? 'button' : 'image'} accessibilityLabel={label ?? t('mascot.label')}
      accessibilityHint={interactive ? hint ?? t('mascot.hint') : undefined} style={styles.target}>
      {backdrop === 'bubble' ? (
        // A round chat bubble with a short tail at the lower left, drawn as one outlined shape; it moves with Poof, so the layout never shifts.
        <Animated.View style={[styles.bubble, { width: bubbleScale * BUBBLE.width, height: bubbleScale * BUBBLE.height, borderRadius: bubbleScale * BUBBLE.r, shadowColor: tokens.poofBubbleGlow, ...motion }]}>
          <Svg testID="poof-bubble-shape" width={bubbleScale * BUBBLE.width} height={bubbleScale * BUBBLE.height} viewBox={`0 0 ${BUBBLE.width} ${BUBBLE.height}`} style={StyleSheet.absoluteFill}>
            <Path d={BUBBLE.path} fill={tokens.poofBubble} stroke={tokens.poofBubbleBorder} strokeWidth={2.4} strokeLinejoin="round" />
          </Svg>
          <View style={[styles.bubbleArt, { left: bubbleScale * BUBBLE.cx - size * POOF_ASPECT / 2, top: bubbleScale * BUBBLE.cy - size / 2 }]}>{art}</View>
        </Animated.View>
      ) : (
        // The backdrop disc (dark theme only) moves with Poof; Poof's artwork itself is unchanged.
        <Animated.View style={[styles.backdrop, { width: size * 1.18, height: size * 1.18, borderRadius: size, backgroundColor: tokens.mascotBackdrop, ...motion }]}>
          {art}
        </Animated.View>
      )}
    </Pressable>
  );
}

// The chat bubble in its own 72 × 70 units: a circle (centre 38,32, radius 31) with a small tail at the lower left.
// The tail's base spans 121°–147° on the circle and its tip sits 1.4 radii out at 135°, matching the reference chat icon.
// The path runs from the circle to the tip, back to the circle, then round the long arc. The circle is 1.5 × Poof's height across.
const BUBBLE = { width: 72, height: 70, cx: 38, cy: 32, r: 31, path: 'M 12 48.88 L 7.31 62.69 L 22.03 58.57 A 31 31 0 1 0 12 48.88 Z' };

const styles = StyleSheet.create({
  target: { alignItems: 'center', justifyContent: 'flex-end' },
  backdrop: { alignItems: 'center', justifyContent: 'center' },
  bubble: { shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  bubbleArt: { position: 'absolute' },
});
