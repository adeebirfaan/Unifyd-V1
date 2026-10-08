import type { ReactElement, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';

export function Screen({ children, refreshControl, compact = false }: { children: ReactNode; refreshControl?: ReactElement<RefreshControlProps>; compact?: boolean }) {
  const insets = useSafeAreaInsets();
  const { tokens } = useAppearance();
  return (
    <ScrollView style={[styles.scroll, { backgroundColor: tokens.screenBackground }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + (compact ? spacing.space2 : spacing.space6) }]} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.space6, paddingBottom: 112 },
  inner: { width: '100%', maxWidth: 520, alignSelf: 'center' },
});
