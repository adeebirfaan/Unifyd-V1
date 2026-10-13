import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];
export type IconQuickAction = { key: string; icon: IconName; label: string; a11y: string; hint?: string; onPress: () => void; primary?: boolean };

const COLUMNS = 4;
const LABEL_SIZE = typography.label.fontSize;
const MIN_LABEL_SIZE = 10; // reached only on 320 pt phones
// A semibold label's average glyph is about half its size; slightly over-estimated so a word never breaks.
const GLYPH = 0.53;

/** One label size for the whole grid: the largest (up to 13 pt) at which its longest word fits a tile. */
export function quickLabelSize(gridWidth: number, labels: readonly string[]): number {
  if (!gridWidth) return LABEL_SIZE;
  const room = (gridWidth - spacing.space2 * (COLUMNS - 1)) / COLUMNS + spacing.space1 * 2;
  const longest = Math.max(1, ...labels.flatMap((label) => label.split(/\s+/).map((word) => word.length)));
  return Math.max(MIN_LABEL_SIZE, Math.min(LABEL_SIZE, Math.floor((room / (longest * GLYPH)) * 2) / 2));
}

/**
 * A grid of compact icon shortcuts (rounded-square icon over a short label), shared by Wallet and Studies.
 * The primary action is filled Unifyd blue; the rest use the dark card surface with a cyan icon.
 * Four equal columns: more actions continue on the next row in order, and a short last row stays left-aligned
 * with the same tile width (empty spacers fill it), so a single extra tile is never stretched. Four fit a 320 pt
 * phone. Labels wrap between words onto two lines; every label shares one size, reduced (to no less than 10 pt, on 320 pt phones only)
 * only when the longest word ("Subscriptions") would otherwise break inside a narrow tile.
 */
export function IconQuickActions({ actions, testIDPrefix }: { actions: IconQuickAction[]; testIDPrefix: string }) {
  const { tokens } = useAppearance();
  const [width, setWidth] = useState(0);
  const size = quickLabelSize(width, actions.map((action) => action.label));
  const rows: IconQuickAction[][] = [];
  for (let index = 0; index < actions.length; index += COLUMNS) rows.push(actions.slice(index, index + COLUMNS));
  return <View style={styles.grid} onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}>{rows.map((row, rowIndex) => <View key={rowIndex} style={styles.row}>
    {row.map((action) => <Pressable key={action.key} testID={`${testIDPrefix}-${action.key}`} accessibilityRole="button" accessibilityLabel={action.a11y} accessibilityHint={action.hint} onPress={action.onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={[styles.icon, action.primary
        ? { backgroundColor: tokens.brandBlue }
        : { backgroundColor: tokens.cardBackground, borderColor: tokens.border, borderWidth: 1 }]}>
        <Ionicons name={action.icon} size={action.primary ? 26 : 22} color={action.primary ? colors.white : tokens.brandCyan} />
      </View>
      <Text style={[styles.label, { color: tokens.screenText, fontSize: size, lineHeight: size + 3 }, action.primary && styles.primaryLabel]} numberOfLines={2}>{action.label}</Text>
    </Pressable>)}
    {Array.from({ length: COLUMNS - row.length }, (_, index) => <View key={`spacer-${index}`} style={styles.tile} />)}
  </View>)}</View>;
}

const styles = StyleSheet.create({
  grid: { gap: spacing.space3 },
  row: { flexDirection: 'row', gap: spacing.space2 },
  tile: { flex: 1, minHeight: 72, alignItems: 'center', gap: spacing.space2, paddingTop: spacing.space1 },
  pressed: { opacity: 0.75 },
  icon: { width: 48, height: 48, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center' },
  // A label may use half of each 8 pt gap, so a long word fits a narrow phone without breaking.
  label: { ...typography.label, textAlign: 'center', letterSpacing: -0.2, alignSelf: 'stretch', marginHorizontal: -spacing.space1 }, primaryLabel: { fontWeight: '700' },
});
