import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BRAND_MARKS } from '@/constants/brandMarks.generated';
import { radius, typography } from '@/constants/theme';
import { subscriptionVisual } from '@/lib/subscriptionBrands';
import { useAppearance } from '@/providers/AppearanceProvider';

/**
 * One consistent tile for every subscription. It holds a Simple Icons brand mark (local SVG path data),
 * a bundled Ionicons mark, an original category icon, or a neutral initial. All four are vectors, so all are
 * drawn in the same Unifyd accent (`brandCyan`, as Wallet's expense icons) on the same dark tile: an app keeps
 * one colour on every surface, and contrast is identical in Dark and Light (tiles stay dark in both).
 * Decorative only: the subscription name is always written beside it, so it is hidden from screen readers.
 * It never animates and never loads anything over the network.
 */
export function SubscriptionBrandIcon({ name, size = 40 }: { name: string; size?: number }) {
  const { tokens } = useAppearance();
  const visual = subscriptionVisual(name);
  const glyph = size * 0.5;
  const ink = tokens.brandCyan;
  return <View testID={`subscription-icon-${visual.kind}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.tile, { width: size, height: size, backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
    {visual.kind === 'mark'
      ? <Svg testID={`subscription-mark-${visual.brand}`} width={glyph} height={glyph} viewBox="0 0 24 24"><Path d={BRAND_MARKS[visual.brand].path} fill={ink} /></Svg>
      : visual.kind === 'initial'
        ? <Text style={[styles.initial, { color: ink, fontSize: size * 0.42 }]}>{visual.letter}</Text>
        : <Ionicons name={visual.icon} size={glyph} color={ink} />}
  </View>;
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.radiusSm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  initial: { ...typography.body, fontWeight: '700' },
});
