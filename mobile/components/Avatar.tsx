import { Image, StyleSheet, View } from 'react-native';

import { getAvatarUrl } from '@/constants/avatars';

export function Avatar({ id, size = 64 }: { id: string; size?: number }) {
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={{ uri: getAvatarUrl(id) }}
        style={{ width: size, height: size }}
        resizeMode="cover"
        accessibilityLabel="Illustrated profile avatar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: '#F8FAFC' },
});
