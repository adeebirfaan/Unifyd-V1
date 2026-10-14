import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * The Review step's compact photo row: a small thumbnail with "Tap to view", opening the photo full screen.
 * The prepared photo lives only in memory for this review; nothing here saves it.
 */
export function ReceiptPhotoRow({ uri }: { uri: string }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return <>
    <Pressable testID="scan-photo-row" accessibilityRole="button" accessibilityLabel={t('scan.photoOpen')} onPress={() => setOpen(true)}
      style={({ pressed }) => [styles.row, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }, pressed && styles.pressed]}>
      <Image source={{ uri }} resizeMode="cover" style={[styles.thumb, { backgroundColor: tokens.cardElevated }]} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: tokens.cardText }]}>{t('scan.photo')}</Text>
        <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('scan.photoTap')}</Text>
      </View>
      <Ionicons name="expand-outline" size={20} color={tokens.cardMutedText} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View testID="scan-photo-viewer" style={[styles.viewer, { paddingTop: insets.top + spacing.space2, paddingBottom: insets.bottom + spacing.space4 }]} accessibilityViewIsModal aria-modal>
        <Pressable testID="scan-photo-close" accessibilityRole="button" accessibilityLabel={t('scan.photoClose')} onPress={() => setOpen(false)}
          style={[styles.close, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
          <Ionicons name="close" size={22} color={tokens.cardText} />
        </Pressable>
        <Image source={{ uri }} resizeMode="contain" accessibilityLabel={t('scan.photo')} style={styles.full} />
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  row: { minHeight: 88, borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space3, flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  pressed: { opacity: 0.8 },
  thumb: { width: 56, height: 72, borderRadius: radius.radiusSm },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.body, fontWeight: '600' },
  hint: { ...typography.label, fontWeight: '500' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', paddingHorizontal: spacing.space4, gap: spacing.space3 },
  close: { width: 44, height: 44, borderRadius: radius.radiusFull, borderWidth: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  full: { flex: 1, width: '100%' },
});
