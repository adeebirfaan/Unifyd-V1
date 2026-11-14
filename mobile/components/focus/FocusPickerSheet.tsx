import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, typography } from '@/constants/theme';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export type FocusPickerOption = { key: string; label: string; detail?: string };

/**
 * A bottom sheet with one choice per row (Unifyd Focus subject and task pickers), following the All tasks sheet:
 * drag to close, a close button, the backdrop, Android back, and Reduce Motion. The chosen row has a tick and is
 * announced as selected, so colour is never the only cue. Loading and error states replace the rows.
 */
export function FocusPickerSheet({ visible, title, options, selectedKey, state, errorText, emptyText, footer, onSelect, onRetry, onClose, testID }: {
  visible: boolean; title: string; options: readonly FocusPickerOption[]; selectedKey: string; state: 'loading' | 'ready' | 'error';
  errorText: string; emptyText?: string; footer?: ReactNode; onSelect: (key: string) => void; onRetry: () => void; onClose: () => void; testID: string;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { opening, offset, reduceMotion, headerHandlers, listHandlers, onListScroll } = useSheetDrag(visible, onClose);

  return <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
    <View style={styles.root}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: tokens.modalScrim }]} accessibilityLabel={t('focus.close')} onPress={onClose} />
      <Animated.View key={opening} testID={testID} accessibilityViewIsModal aria-modal
        style={[styles.sheet, { maxHeight: height - insets.top - spacing.space6, backgroundColor: tokens.cardBackground, borderColor: tokens.border, transform: [{ translateY: offset }] }]}>
        <View {...headerHandlers} style={styles.top}>
          <View style={[styles.handle, { backgroundColor: tokens.border }]} />
          <View style={styles.headerRow}>
            <Text accessibilityRole="header" style={[styles.title, { color: tokens.cardText }]}>{title}</Text>
            <Pressable testID={`${testID}-close`} accessibilityRole="button" accessibilityLabel={t('focus.close')} onPress={onClose}
              style={({ pressed }) => [styles.close, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, pressed && styles.pressed]}>
              <Ionicons name="close" size={22} color={tokens.cardText} />
            </Pressable>
          </View>
        </View>
        <View {...listHandlers} style={styles.listWrap}>
          <ScrollView style={styles.list} scrollEventThrottle={16} onScroll={onListScroll}
            contentContainerStyle={{ paddingHorizontal: spacing.space4, paddingBottom: Math.max(insets.bottom, spacing.space4) + spacing.space4, gap: spacing.space2 }}>
            {options.map((option) => {
              const selected = option.key === selectedKey;
              return <Pressable key={option.key} accessibilityRole="radio" accessibilityState={{ checked: selected, selected }} aria-checked={selected} accessibilityLabel={option.detail ? `${option.label}, ${option.detail}` : option.label}
                onPress={() => onSelect(option.key)}
                style={({ pressed }) => [styles.option, { backgroundColor: tokens.cardElevated, borderColor: selected ? tokens.brandCyan : tokens.border }, pressed && styles.pressed]}>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionLabel, { color: tokens.cardText }]} numberOfLines={2}>{option.label}</Text>
                  {option.detail && <Text style={[styles.optionDetail, { color: tokens.cardMutedText }]} numberOfLines={1}>{option.detail}</Text>}
                </View>
                <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? tokens.brandCyan : tokens.cardMutedText} />
              </Pressable>;
            })}
            {state === 'loading' && <View style={styles.status}><ActivityIndicator color={tokens.brandCyan} /></View>}
            {state === 'error' && <View style={styles.status}>
              <Text style={[styles.note, { color: tokens.cardText }]} accessibilityRole="alert">{errorText}</Text>
              <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={[styles.retryText, { color: tokens.brandCyan }]}>{t('focus.retry')}</Text></Pressable>
            </View>}
            {state === 'ready' && emptyText && <Text style={[styles.note, styles.status, { color: tokens.cardMutedText }]}>{emptyText}</Text>}
            {footer}
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
  title: { ...typography.sectionTitle, flex: 1 },
  close: { width: 44, height: 44, borderRadius: radius.radiusFull, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  listWrap: { flexShrink: 1 }, list: { flexGrow: 0 },
  option: { minHeight: 56, borderWidth: 1, borderRadius: radius.radiusMd, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3, flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  optionCopy: { flex: 1, gap: 2 }, optionLabel: { ...typography.body, fontWeight: '600' }, optionDetail: { ...typography.label, fontWeight: '400' },
  status: { paddingVertical: spacing.space4, gap: spacing.space2 },
  note: { ...typography.body, lineHeight: 22 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, retryText: { ...typography.body, fontWeight: '600' },
});
