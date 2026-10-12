import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';

/** Centred confirmation dialog, matching the expense-delete dialog. `destructive` uses the danger button. */
export function ConfirmDialog({ visible, title, body, confirmLabel, cancelLabel, error, busy, destructive = false, onConfirm, onCancel, testID }: {
  visible: boolean; title: string; body: string; confirmLabel: string; cancelLabel: string; error?: string | null; busy: boolean;
  destructive?: boolean; onConfirm: () => void; onCancel: () => void; testID?: string;
}) {
  const { tokens } = useAppearance();
  const confirmBackground = destructive ? tokens.destructiveBackground : tokens.brandBlue;
  const confirmText = destructive ? tokens.destructiveForeground : colors.white;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}>
    <View style={styles.modalRoot}>
      <Pressable style={[styles.scrim, { backgroundColor: tokens.modalScrim }]} disabled={busy} onPress={onCancel} accessibilityLabel={cancelLabel} />
      <View testID={testID} style={[styles.dialog, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} accessibilityViewIsModal>
        <Text style={[styles.title, { color: tokens.cardText }]}>{title}</Text>
        <Text style={[styles.body, { color: tokens.cardMutedText }]}>{body}</Text>
        {error && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{error}</Text>}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onCancel} style={[styles.button, { borderColor: tokens.border, borderWidth: 1, backgroundColor: tokens.cardElevated }]}><Text style={[styles.buttonText, { color: tokens.cardText }]}>{cancelLabel}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={onConfirm} style={[styles.button, { backgroundColor: confirmBackground }]}>{busy ? <ActivityIndicator color={confirmText} /> : <Text style={[styles.buttonText, { color: confirmText }]}>{confirmLabel}</Text>}</Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'center', padding: spacing.space5 }, scrim: { ...StyleSheet.absoluteFill },
  dialog: { width: '100%', maxWidth: 420, alignSelf: 'center', borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space4 },
  title: { ...typography.sectionTitle }, body: { ...typography.body, lineHeight: 23 }, error: { ...typography.label, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.space3 },
  button: { flex: 1, minHeight: 50, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.space2 }, buttonText: { ...typography.body, fontWeight: '700', textAlign: 'center' },
});
