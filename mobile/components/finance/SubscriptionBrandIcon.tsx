import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BRAND_MARKS } from '@/constants/brandMarks.generated';
import { radius, typography } from '@/constants/theme';
import { subscriptionVisual } from '@/lib/subscriptionBrands';
import { useAppearance } from '@/providers/AppearanceProvider';

/**
 * One consistent tile for every subscription. It holds a Simple Icons brand mark (local SVG path data),
 * a bundled Ionicons mark, an original category icon, or a neutral initial. All four share the same size,
 * shape, and restrained colouring, so mixed rows look intentional and contrast is identical in Dark and
 * Light (tiles stay dark in both).
 * Decorative only: the subscription name is always written beside it, so it is hidden from screen readers.
 * It never animates and never loads anything over the network.
 */
export function SubscriptionBrandIcon({ name, size = 40 }: { name: string; size?: number }) {
  const { tokens } = useAppearance();
  const visual = subscriptionVisual(name);
  const glyph = size * 0.5;
  return <View testID={`subscription-icon-${visual.kind}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.tile, { width: size, height: size, backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
    {visual.kind === 'mark'
      ? <Svg testID={`subscription-mark-${visual.brand}`} width={glyph} height={glyph} viewBox="0 0 24 24"><Path d={BRAND_MARKS[visual.brand].path} fill={tokens.cardText} /></Svg>
      : visual.kind === 'initial'
        ? <Text style={[styles.initial, { color: tokens.brandCyan, fontSize: size * 0.42 }]}>{visual.letter}</Text>
        : <Ionicons name={visual.icon} size={glyph} color={visual.kind === 'logo' ? tokens.cardText : tokens.brandCyan} />}
  </View>;
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.radiusSm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  initial: { ...typography.body, fontWeight: '700' },
});
