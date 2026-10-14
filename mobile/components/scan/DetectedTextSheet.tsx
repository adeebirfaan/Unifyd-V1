import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, typography } from '@/constants/theme';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * The raw OCR text in a bottom sheet (the AllExpensesSheet pattern: handle, drag to close, close button, backdrop,
 * Android back, Reduce Motion aware), so it never takes room on the Review page. The text is selectable.
 */
export function DetectedTextSheet({ visible, text, onClose }: { visible: boolean; text: string; onClose: () => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { opening, offset, reduceMotion, headerHandlers, listHandlers, onListScroll } = useSheetDrag(visible, onClose);
  return <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
    <View style={styles.root}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: tokens.modalScrim }]} accessibilityLabel={t('scan.textClose')} onPress={onClose} />
      <Animated.View key={opening} testID="scan-text-sheet" accessibilityViewIsModal aria-modal
        style={[styles.sheet, { maxHeight: height - insets.top - spacing.space6, backgroundColor: tokens.cardBackground, borderColor: tokens.border, transform: [{ translateY: offset }] }]}>
        <View {...headerHandlers} style={styles.top}>
          <View style={[styles.handle, { backgroundColor: tokens.border }]} />
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={[styles.title, { color: tokens.cardText }]}>{t('scan.textTitle')}</Text>
              <Text style={[styles.subtitle, { color: tokens.cardMutedText }]}>{t('scan.textBody')}</Text>
            </View>
            <Pressable testID="scan-text-close" accessibilityRole="button" accessibilityLabel={t('scan.textClose')} onPress={onClose}
              style={({ pressed }) => [styles.close, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, pressed && styles.pressed]}>
              <Ionicons name="close" size={22} color={tokens.cardText} />
            </Pressable>
          </View>
        </View>
        <View {...listHandlers} style={styles.bodyWrap}>
          <ScrollView style={styles.body} contentContainerStyle={{ paddingHorizontal: spacing.space5, paddingBottom: Math.max(insets.bottom, spacing.space4) + spacing.space4 }}
            scrollEventThrottle={16} onScroll={onListScroll}>
            <Text testID="scan-text-body" selectable style={[styles.raw, { color: tokens.cardText, backgroundColor: tokens.cardElevated }]}>{text.trim() || t('scan.textEmpty')}</Text>
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 568, alignSelf: 'center', flexShrink: 1, borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg, borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden' },
  top: { paddingHorizontal: spacing.space5, paddingTop: spacing.space3, paddingBottom: spacing.space3, gap: spacing.space3 },
  handle: { width: 40, height: 4, borderRadius: radius.radiusFull, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  headerCopy: { flex: 1, gap: 2 },
  title: { ...typography.sectionTitle }, subtitle: { ...typography.label, fontWeight: '500', lineHeight: 18 },
  close: { width: 44, height: 44, borderRadius: radius.radiusFull, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  bodyWrap: { flexShrink: 1 }, body: { flexGrow: 0 },
  raw: { ...typography.body, fontSize: 15, lineHeight: 22, borderRadius: radius.radiusMd, padding: spacing.space4 },
});
