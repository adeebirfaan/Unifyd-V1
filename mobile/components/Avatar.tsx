import { Image, StyleSheet, View } from 'react-native';

import { getAvatar } from '@/constants/avatars';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * A student's avatar from the bundled library. The whole illustration is shown
 * (contain, never cropped) on a white circle, so faces and blue details stay intact.
 * Unknown or legacy stored values show the default avatar.
 */
export function Avatar({ id, size = 64 }: { id: string | null | undefined; size?: number }) {
  const { t } = useI18n();
  const avatar = getAvatar(id);
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={avatar.source} style={{ width: size, height: size }} resizeMode="contain"
        accessibilityRole="image" accessibilityLabel={t('avatar.image', { name: t(avatar.labelKey) })} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
