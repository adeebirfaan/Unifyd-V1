import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ExpenseTextField } from '@/components/wallet/ExpenseTextField';
import { radius, spacing, typography } from '@/constants/theme';
import { parseItemInput } from '@/lib/scanFlow';
import type { ItemErrors, ReceiptItem } from '@/lib/scanFlow';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export type ItemEditing = { item: ReceiptItem | null; discount: boolean };

/** A small sheet to add, edit, or remove one receipt line. Discounts are entered as a positive amount. */
export function ReceiptItemSheet({ editing, onDone, onRemove, onClose }: {
  editing: ItemEditing | null; onDone: (item: ReceiptItem) => void; onRemove: () => void; onClose: () => void;
}) {
  return <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={onClose}>
    {/* Remounted per opening, so each edit starts from the chosen line's values. */}
    {editing && <ItemForm key={editing.item ? `${editing.item.name}-${editing.item.amount}` : `new-${editing.discount}`} editing={editing} onDone={onDone} onRemove={onRemove} onClose={onClose} />}
  </Modal>;
}

function ItemForm({ editing, onDone, onRemove, onClose }: { editing: ItemEditing; onDone: (item: ReceiptItem) => void; onRemove: () => void; onClose: () => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { item, discount } = editing;
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [price, setPrice] = useState(item ? Math.abs(item.amount).toFixed(2) : '');
  const [errors, setErrors] = useState<ItemErrors>({});
  const title = t(item ? (discount ? 'scan.discountEdit' : 'scan.itemEdit') : (discount ? 'scan.discountNew' : 'scan.itemNew'));

  function done() {
    const parsed = parseItemInput({ name, quantity, price }, discount);
    setErrors(parsed.errors);
    if (parsed.item) onDone(parsed.item);
  }

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: tokens.modalScrim }]} accessibilityLabel={t('scan.itemClose')} onPress={onClose} />
    <View testID="scan-item-sheet" accessibilityViewIsModal aria-modal style={[styles.sheet, { backgroundColor: tokens.cardBackground, borderColor: tokens.border, paddingBottom: Math.max(insets.bottom, spacing.space4) + spacing.space2 }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: tokens.cardText }]}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('scan.itemClose')} onPress={onClose} style={[styles.close, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
          <Ionicons name="close" size={22} color={tokens.cardText} />
        </Pressable>
      </View>
      <ExpenseTextField label={t('scan.itemName')} value={name} onChangeText={(value) => { setName(value); setErrors((current) => ({ ...current, name: undefined })); }} placeholder="" maxLength={200} error={errors.name && t('scan.itemNameRequired')} />
      <View style={styles.pair}>
        {!discount && <View style={styles.quantity}>
          <ExpenseTextField label={t('scan.itemQty')} value={quantity} onChangeText={(value) => { setQuantity(value); setErrors((current) => ({ ...current, quantity: undefined })); }} placeholder="1" keyboardType="number-pad" maxLength={3} error={errors.quantity && t('scan.itemQtyInvalid')} />
        </View>}
        <View style={styles.price}>
          <ExpenseTextField label={t(discount ? 'scan.discountAmount' : 'scan.itemPrice')} value={price} onChangeText={(value) => { setPrice(value); setErrors((current) => ({ ...current, price: undefined })); }} placeholder="0.00" prefix={discount ? '−RM' : 'RM'} keyboardType="decimal-pad" error={errors.price && t('scan.itemPriceInvalid')} />
        </View>
      </View>
      <PrimaryButton onPress={done}>{t('scan.itemDone')}</PrimaryButton>
      {item && <Pressable testID="scan-item-remove" accessibilityRole="button" onPress={onRemove} style={styles.remove}>
        <Ionicons name="trash-outline" size={18} color={tokens.cardErrorText} />
        <Text style={[styles.removeText, { color: tokens.cardErrorText }]}>{t('scan.itemRemove')}</Text>
      </Pressable>}
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 568, alignSelf: 'center', borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: spacing.space5, paddingTop: spacing.space4, gap: spacing.space4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  title: { ...typography.sectionTitle, flex: 1 },
  close: { width: 44, height: 44, borderRadius: radius.radiusFull, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', gap: spacing.space3 },
  quantity: { width: 104 }, price: { flex: 1 },
  remove: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2 },
  removeText: { ...typography.body, fontWeight: '600' },
});
