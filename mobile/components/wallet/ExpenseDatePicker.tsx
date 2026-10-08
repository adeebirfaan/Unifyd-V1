import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, radius, typography } from '@/constants/theme';
import { isValidISODate, localDateISO } from '@/lib/expenseForm';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export function ExpenseDatePicker({ value, onChange, error, label, pickerTitle }: { value: string; onChange: (date: string) => void; error?: string; label?: string; pickerTitle?: string }) {
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const initial = isValidISODate(value) ? new Date(`${value}T12:00:00`) : new Date();
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const locale = language === 'ms' ? 'ms-MY' : 'en-MY';
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month);
  const selectedLabel = isValidISODate(value)
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(initial)
    : (label ?? t('expense.date'));
  const leading = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: leading + days }, (_, index) => index < leading ? null : index - leading + 1);

  function choose(day: number) {
    onChange(localDateISO(new Date(month.getFullYear(), month.getMonth(), day)));
    setVisible(false);
  }

  return <View style={styles.field}>
    <Text style={[styles.label, { color: tokens.cardText }]}>{label ?? t('expense.date')}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label ?? t('expense.date')}: ${selectedLabel}`} onPress={() => setVisible(true)} style={[styles.control, { backgroundColor: tokens.cardElevated, borderColor: error ? tokens.cardErrorText : tokens.border }]}>
      <Text style={[styles.controlText, { color: tokens.cardText }]}>{selectedLabel}</Text>
      <Ionicons name="calendar-outline" size={21} color={tokens.brandCyan} />
    </Pressable>
    {error && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{error}</Text>}
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.modalRoot}>
        <Pressable style={[styles.scrim, { backgroundColor: tokens.modalScrim }]} onPress={() => setVisible(false)} accessibilityLabel={t('expense.closeDate')} />
        <View style={[styles.calendar, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <View style={styles.header}>
            <Text style={[styles.heading, { color: tokens.cardText }]}>{pickerTitle ?? t('expense.datePickerTitle')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('expense.closeDate')} onPress={() => setVisible(false)} style={styles.iconButton}><Ionicons name="close" size={22} color={tokens.cardText} /></Pressable>
          </View>
          <View style={styles.monthRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('expense.previousMonth')} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.iconButton}><Ionicons name="chevron-back" size={22} color={tokens.cardText} /></Pressable>
            <Text style={[styles.month, { color: tokens.cardText }]}>{monthLabel}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('expense.nextMonth')} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.iconButton}><Ionicons name="chevron-forward" size={22} color={tokens.cardText} /></Pressable>
          </View>
          <View style={styles.days}>{t('expense.weekdays').split(',').map((day, index) => <Text key={index} style={[styles.weekday, { color: tokens.cardMutedText }]}>{day}</Text>)}</View>
          <View style={styles.days}>{cells.map((day, index) => {
            const iso = day ? localDateISO(new Date(month.getFullYear(), month.getMonth(), day)) : '';
            const selected = iso === value;
            return day ? <Pressable key={index} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(new Date(month.getFullYear(), month.getMonth(), day))} onPress={() => choose(day)} style={[styles.day, selected && { backgroundColor: tokens.brandBlue }]}><Text style={[styles.dayText, { color: tokens.cardText }]}>{day}</Text></Pressable> : <View key={index} style={styles.day} />;
          })}</View>
          <Pressable accessibilityRole="button" onPress={() => { onChange(localDateISO()); setVisible(false); }} style={styles.today}><Text style={[styles.todayText, { color: tokens.brandCyan }]}>{t('expense.today')}</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: spacing.space2 }, label: { ...typography.label },
  control: { minHeight: 54, borderWidth: 1, borderRadius: radius.radiusMd, paddingHorizontal: spacing.space4, flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  controlText: { ...typography.body, flex: 1 }, error: { ...typography.label },
  modalRoot: { flex: 1, justifyContent: 'center', padding: spacing.space4 }, scrim: { ...StyleSheet.absoluteFill },
  calendar: { width: '100%', maxWidth: 400, alignSelf: 'center', borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heading: { ...typography.sectionTitle, flex: 1 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.space4 }, month: { ...typography.body, fontWeight: '700' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  days: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.2857%', textAlign: 'center', ...typography.label, paddingBottom: spacing.space2 },
  day: { width: '14.2857%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.radiusFull }, dayText: { ...typography.body },
  today: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: spacing.space3 }, todayText: { ...typography.body, fontWeight: '600' },
});
