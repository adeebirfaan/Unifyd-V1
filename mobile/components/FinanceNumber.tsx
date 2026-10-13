import { useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import type { LayoutChangeEvent, TextProps } from 'react-native';

import { fonts } from '@/constants/theme';

const WEB = Platform.OS === 'web';
// On the web a generic monospace stands in if the font file is ever unavailable; native needs one exact name.
const FAMILY = WEB ? `${fonts.financeNumber}, ui-monospace, Menlo, Consolas, monospace` : fonts.financeNumber;
// Space Mono's natural line height is about 1.48 × its size (the system font's is about 1.2), so it is fixed
// here to keep rows and cards the same height as before.
export const LINE_HEIGHT = 1.25;
export const LETTER_SPACING = -0.5;
// Every Space Mono glyph is 0.612 em wide, so a value's width can be calculated exactly.
export const ADVANCE = 0.612;
export const MIN_SCALE = 0.6;

/**
 * A finance display number (amounts, balances, percentages) in Unifyd's finance font.
 * Callers keep their own size and colour. The font has one weight, so the weight is
 * fixed to regular and never synthesised. `fit` keeps large amounts on one line,
 * shrinking them on narrow phones instead of clipping. Not for editable inputs.
 */
export function FinanceNumber({ style, fit = false, onLayout, children, ...props }: TextProps & { fit?: boolean }) {
  const { fontSize: baseSize = 16, lineHeight } = StyleSheet.flatten(style) ?? {};
  const text = typeof children === 'string' ? children : '';
  // React Native Web ignores adjustsFontSizeToFit, so on the web the value is shrunk here instead.
  const [webFit, setWebFit] = useState<{ text: string; scale: number }>({ text, scale: 1 });
  const scale = WEB && fit && webFit.text === text ? webFit.scale : 1;
  const fontSize = baseSize * scale;

  function measure(event: LayoutChangeEvent) {
    onLayout?.(event);
    if (!WEB || !fit || !text) return;
    const needed = text.length * (ADVANCE * fontSize + LETTER_SPACING);
    const width = event.nativeEvent.layout.width;
    // Shrink only while the text is being cut off, so the size settles instead of shrinking repeatedly.
    if (width >= needed - 0.5) return;
    // Solve width = n × (ADVANCE × size + spacing) for the size, keeping a 3% margin for sub-pixel rounding.
    const fitted = ((width / text.length - LETTER_SPACING) / ADVANCE) * 0.97;
    setWebFit({ text, scale: Math.max(MIN_SCALE, Math.min(1, fitted / baseSize)) });
  }

  return <Text {...props} onLayout={measure} {...(fit ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: MIN_SCALE } : null)}
    style={[style, styles.font, { fontSize, lineHeight: lineHeight ?? Math.round(baseSize * LINE_HEIGHT) }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  font: { fontFamily: FAMILY, fontWeight: '400', fontVariant: ['tabular-nums'], letterSpacing: LETTER_SPACING },
});

/** The same finance font for the one editable amount that uses it (Manage budget, owner request 2026-10-13). */
export const financeFontStyle = styles.font;
