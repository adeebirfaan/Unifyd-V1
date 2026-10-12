import { StyleSheet, View } from 'react-native';

import { PoofMascot } from '@/components/mascot/PoofMascot';
import { spacing } from '@/constants/theme';
import { useI18n } from '@/providers/LanguageProvider';

// Poof's height inside the bubble (the bubble is about 69 × 60 pt), a little larger than the earlier 56 pt button.
const POOF_SIZE = 46;

/**
 * Home's only Poof: the chat launcher at the lower right, above the tab bar and
 * clear of the centre quick-action button. Poof floats in a speech bubble,
 * welcomes once per app session, and hops when tapped; the chat opens at once.
 */
export function PoofLauncher({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <PoofMascot variant="welcome" size={POOF_SIZE} backdrop="bubble" onPress={onPress}
        testID="poof-launcher" label={t('poof.launch')} hint={t('poof.launchHint')} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Extra bottom space leaves room for the bubble's tail and the idle float.
  layer: { position: 'absolute', right: spacing.space4, bottom: spacing.space5 },
});
