import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FinanceNumber } from '@/components/FinanceNumber';
import { ReceiptItemSheet } from '@/components/scan/ReceiptItemSheet';
import type { ItemEditing } from '@/components/scan/ReceiptItemSheet';
import { radius, spacing, typography } from '@/constants/theme';
import { formatRinggit } from '@/lib/expenseHistory';
import { ITEMS_PREVIEW, itemsMismatch, itemsTotalCents, shownUnitPrice, visibleItems } from '@/lib/scanFlow';
import type { DraftItem, ReceiptItem } from '@/lib/scanFlow';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * Receipt lines for checking the total. Shown only when the server returned items. With more than four lines it
 * starts collapsed. Names wrap (never cut off), amounts always have two decimals, and discounts carry an icon and a
 * minus sign. Items are a review aid only: they are never saved, and the Total field is never changed for them.
 */
export function ReceiptItemsCard({ items, totalAmount, incomplete, onChange }: {
  items: readonly DraftItem[]; totalAmount: number | null; incomplete: boolean; onChange: (items: DraftItem[]) => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<(ItemEditing & { id: string | null }) | null>(null);
  const [nextId, setNextId] = useState(0);
  const shown = visibleItems(items, expanded);
  const divider = <View style={[styles.divider, { backgroundColor: tokens.border }]} />;

  function done(item: ReceiptItem) {
    if (!editing) return;
    // An edited line keeps its printed unit price only while quantity × unit still equals the amount.
    if (editing.id) onChange(items.map((current) => current.id === editing.id ? { ...item, unitPrice: shownUnitPrice(item.quantity, current.unitPrice, item.amount), id: current.id } : current));
    else { onChange([...items, { ...item, id: `added-${nextId}` }]); setNextId((count) => count + 1); }
    setEditing(null);
  }
  function remove() {
    if (editing?.id) onChange(items.filter((current) => current.id !== editing.id));
    setEditing(null);
  }

  return <View testID="scan-items" style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <Text accessibilityRole="header" style={[styles.heading, { color: tokens.cardMutedText }]}>{items.length === 1 ? t('scan.itemsOne') : t('scan.itemsMany', { count: items.length })}</Text>
    {incomplete && <View testID="scan-items-incomplete" style={styles.note}>
      <Ionicons name="alert-circle-outline" size={16} color={tokens.cardWarningText} />
      <Text style={[styles.noteText, { color: tokens.cardWarningText }]}>{t('scan.itemsIncomplete')}</Text>
    </View>}
    {shown.map((item, index) => {
      const discount = item.amount < 0;
      const amount = formatRinggit(Math.abs(item.amount));
      return <View key={item.id}>
        {index > 0 && divider}
        <Pressable testID="scan-item-row" accessibilityRole="button" onPress={() => setEditing({ id: item.id, item, discount })}
          accessibilityLabel={discount ? t('scan.discountA11y', { name: item.name, amount }) : t('scan.itemA11y', { name: item.name, quantity: item.quantity, amount })}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          {discount && <Ionicons name="pricetag-outline" size={16} color={tokens.cardMutedText} />}
          <View style={styles.nameBlock}>
            <Text style={[styles.name, { color: tokens.cardText }]}>{item.name}</Text>
            {!discount && item.unitPrice !== null && item.quantity > 1 && <Text style={[styles.unit, { color: tokens.cardMutedText }]}>{t('scan.itemUnit', { quantity: item.quantity, price: formatRinggit(item.unitPrice) })}</Text>}
          </View>
          {!discount && item.quantity > 1 && item.unitPrice === null && <Text style={[styles.quantity, { color: tokens.cardMutedText }]}>{t('scan.itemQuantity', { count: item.quantity })}</Text>}
          <FinanceNumber style={[styles.amount, { color: tokens.cardText }]}>{discount ? `−${amount}` : amount}</FinanceNumber>
        </Pressable>
      </View>;
    })}
    {items.length > ITEMS_PREVIEW && <Pressable testID="scan-items-toggle" accessibilityRole="button" onPress={() => setExpanded((open) => !open)} style={styles.toggle}>
      <Text style={[styles.link, { color: tokens.pageAccent }]}>{expanded ? t('scan.itemsShowFewer') : t('scan.itemsShowAll', { count: items.length })}</Text>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={tokens.pageAccent} />
    </Pressable>}
    {divider}
    <View style={styles.addRow}>
      <Pressable testID="scan-item-add" accessibilityRole="button" onPress={() => setEditing({ id: null, item: null, discount: false })} style={styles.add}>
        <Ionicons name="add" size={18} color={tokens.pageAccent} /><Text style={[styles.link, { color: tokens.pageAccent }]}>{t('scan.addItem')}</Text>
      </Pressable>
      <Pressable testID="scan-discount-add" accessibilityRole="button" onPress={() => setEditing({ id: null, item: null, discount: true })} style={styles.add}>
        <Ionicons name="pricetag-outline" size={16} color={tokens.pageAccent} /><Text style={[styles.link, { color: tokens.pageAccent }]}>{t('scan.addDiscount')}</Text>
      </Pressable>
    </View>
    {itemsMismatch(items, totalAmount) && totalAmount !== null && <View testID="scan-items-mismatch" style={styles.note}>
      <Ionicons name="alert-circle-outline" size={16} color={tokens.cardWarningText} />
      <Text style={[styles.noteText, { color: tokens.cardWarningText }]}>{t('scan.itemsMismatch', { items: formatRinggit(itemsTotalCents(items) / 100), total: formatRinggit(totalAmount) })}</Text>
    </View>}
    <Text style={[styles.noteText, { color: tokens.cardMutedText }]}>{t('scan.itemsNote')}</Text>
    <ReceiptItemSheet editing={editing} onDone={done} onRemove={remove} onClose={() => setEditing(null)} />
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space4, gap: spacing.space2 },
  heading: { ...typography.label },
  divider: { height: StyleSheet.hairlineWidth },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingVertical: spacing.space2 },
  pressed: { opacity: 0.75 },
  nameBlock: { flex: 1, gap: 2 },
  name: { ...typography.body, lineHeight: 21 },
  unit: { ...typography.label, fontWeight: '500' },
  quantity: { ...typography.label },
  amount: { fontSize: 15 },
  toggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space1 },
  link: { ...typography.label, fontSize: 14 },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space4 },
  add: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space1 },
  noteText: { ...typography.label, fontWeight: '500', lineHeight: 18, flexShrink: 1 },
});
