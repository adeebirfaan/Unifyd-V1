import { Image, StyleSheet, View } from 'react-native';

import { POOF_ASPECT, POOF_IMAGE } from '@/components/mascot/PoofMascot';
import { semanticThemes } from '@/constants/theme';

/**
 * A still Poof for small spaces such as the chat button and message rows. It uses
 * the same approved artwork as PoofMascot, unchanged, on a soft light disc so
 * Poof's dark outlines stay visible on dark surfaces.
 */
export function PoofAvatar({ size = 32 }: { size?: number }) {
  const art = size * 0.78;
  return (
    <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={POOF_IMAGE} resizeMode="contain" style={{ width: art * POOF_ASPECT, height: art }} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { backgroundColor: semanticThemes.dark.mascotBackdrop, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
