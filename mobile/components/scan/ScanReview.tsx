import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ScrollViewInstance, TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { SelectionField } from '@/components/profile/SelectionField';
import { DetectedTextSheet } from '@/components/scan/DetectedTextSheet';
import { ReceiptItemsCard } from '@/components/scan/ReceiptItemsCard';
import { ReceiptPhotoRow } from '@/components/scan/ReceiptPhotoRow';
import { ReviewFlag } from '@/components/scan/ReviewFlag';
import { CategorySuggestion } from '@/components/wallet/CategorySuggestion';
import { ExpenseDatePicker } from '@/components/wallet/ExpenseDatePicker';
import { ExpenseTextField } from '@/components/wallet/ExpenseTextField';
import { radius, spacing, typography } from '@/constants/theme';
import { useExpenseDraft } from '@/hooks/useExpenseDraft';
import type { ExpenseDraftField } from '@/hooks/useExpenseDraft';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { EXPENSE_CATEGORIES, parseExpenseAmount } from '@/lib/expenseForm';
import type { ExpenseCategory, ExpenseInput } from '@/lib/expenseForm';
import type { ReceiptOcrResult } from '@/lib/receiptOcr';
import { draftAmount, draftItems, reviewFlags, suggestRetake } from '@/lib/scanFlow';
import type { DraftItem, ReviewField } from '@/lib/scanFlow';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/**
 * Step 3: a compact review. Photo row → Details (merchant, date, total, category, optional note) with the server's
 * uncertain fields marked "Check" → Items (only when the server returned them) → "View detected text" (a sheet).
 * "Save expense" is fixed at the bottom outside the scroll area, hidden only while the keyboard is open.
 * Category always starts empty; the optional suggestion is applied only when tapped. Nothing is saved until Save.
 * When the photo was hard to read (no text, or two or more uncertain fields), the notice offers "Retake photo" until
 * the student edits a field, so retaking never discards their changes.
 */
export function ScanReview({ imageUri, result, onSave, onBack, onRetake }: {
  imageUri: string; result: ReceiptOcrResult; onSave: (input: ExpenseInput) => Promise<boolean>; onBack: () => void; onRetake: () => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const draft = useExpenseDraft({
    initial: { title: result.merchantName ?? '', amount: draftAmount(result.totalAmount), category: null, expenseDate: result.purchaseDate ?? '', notes: '' },
    onSave, errorKey: 'scan.saveError', suggestCategory: true,
  });
  const [flags] = useState(() => reviewFlags(result.warnings));
  const [edited, setEdited] = useState<Record<ReviewField, boolean>>({ merchant: false, date: false, total: false });
  const [items, setItems] = useState<DraftItem[]>(() => draftItems(result.items));
  const [noteOpen, setNoteOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const merchantInput = useRef<TextInputInstance>(null);
  const amountInput = useRef<TextInputInstance>(null);
  const layout = useRef<{ card: number; fields: Partial<Record<ExpenseDraftField, number>> }>({ card: 0, fields: {} });
  const { errors } = draft;
  const flagged = (field: ReviewField) => flags.fields[field] && !edited[field];
  const retake = suggestRetake(flags) && !Object.values(edited).some(Boolean);
  const markEdited = (field: ReviewField) => setEdited((current) => current[field] ? current : { ...current, [field]: true });
  const a11y = (label: string, field: ReviewField) => flagged(field) ? `${label}, ${t('scan.needsReview')}` : label;
  const categoryOptions = EXPENSE_CATEGORIES.map((id) => ({ id, label: t(`expense.category.${id}`) }));
  const divider = <View style={[styles.divider, { backgroundColor: tokens.border }]} />;

  async function save() {
    const invalid = await draft.save();
    if (!invalid) return;
    // Bring the first invalid field into view, and focus it when it is a text field.
    scroll.current?.scrollTo({ y: Math.max(0, layout.current.card + (layout.current.fields[invalid] ?? 0) - spacing.space4), animated: true });
    if (invalid === 'title') merchantInput.current?.focus();
    if (invalid === 'amount') amountInput.current?.focus();
  }

  const label = (text: string, field: ReviewField) => <View style={styles.labelRow}>
    <Text style={[styles.fieldLabel, { color: tokens.cardText }]}>{text}</Text>
    {flagged(field) && <ReviewFlag testID={`scan-flag-${field}`} />}
  </View>;

  return <KeyboardAvoidingView testID="scan-review" style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={scroll} style={styles.fill} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space2 }]} keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <View style={styles.header}>
        <Pressable testID="scan-review-back" onPress={onBack} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}><Ionicons name="arrow-back" size={22} color={tokens.screenText} /></Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: tokens.screenText }]} numberOfLines={1}>{t('scan.reviewTitle')}</Text>
      </View>

      <ReceiptPhotoRow uri={imageUri} />

      <View testID="scan-details" onLayout={(event) => { layout.current.card = event.nativeEvent.layout.y; }} style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <Text accessibilityRole="header" style={[styles.heading, { color: tokens.cardMutedText }]}>{t('scan.details')}</Text>
        {(retake || flags.noText || flags.other) && <View testID="scan-review-notice" style={styles.noticeBlock}>
          <View style={styles.notice}>
            <Ionicons name="alert-circle-outline" size={18} color={tokens.cardWarningText} />
            <Text accessibilityLiveRegion="polite" style={[styles.noticeText, { color: tokens.cardWarningText }]}>
              {t(flags.noText ? 'scan.warningNoText' : retake ? 'scan.retakeHint' : 'scan.warningOther')}
            </Text>
          </View>
          {retake && <Pressable testID="scan-retake" onPress={onRetake} accessibilityRole="button"
            style={({ pressed }) => [styles.retake, { borderColor: tokens.border, backgroundColor: tokens.cardElevated }, pressed && styles.pressed]}>
            <Ionicons name="camera-outline" size={18} color={tokens.cardText} />
            <Text style={[styles.retakeText, { color: tokens.cardText }]}>{t('scan.retake')}</Text>
          </Pressable>}
        </View>}

        <View onLayout={(event) => { layout.current.fields.title = event.nativeEvent.layout.y; }} style={styles.field}>
          {label(t('scan.merchant'), 'merchant')}
          <TextInput ref={merchantInput} testID="scan-merchant" value={draft.title} multiline submitBehavior="blurAndSubmit" returnKeyType="done" maxLength={120}
            onChangeText={(value) => { draft.setTitle(value.replace(/\s*\n\s*/g, ' ')); markEdited('merchant'); }}
            placeholder={flagged('merchant') && !draft.title ? t('scan.notFound') : t('scan.merchantPlaceholder')} placeholderTextColor={tokens.cardMutedText}
            selectionColor={tokens.brandCyan} accessibilityLabel={a11y(t('scan.merchant'), 'merchant')}
            style={[styles.input, styles.merchant, { color: tokens.cardText, backgroundColor: tokens.cardElevated, borderColor: errors.title ? tokens.cardErrorText : tokens.border }]} />
          {errors.title && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{errors.title}</Text>}
        </View>
        {divider}
        <View onLayout={(event) => { layout.current.fields.date = event.nativeEvent.layout.y; }}>
          <ExpenseDatePicker variant="row" label={t('scan.date')} value={draft.expenseDate} error={errors.date}
            onChange={(value) => { draft.setExpenseDate(value); markEdited('date'); }}
            placeholder={flagged('date') ? t('scan.dateNotFound') : undefined}
            accessory={flagged('date') ? <ReviewFlag testID="scan-flag-date" /> : undefined} a11ySuffix={flagged('date') ? t('scan.needsReview') : undefined} />
        </View>
        {divider}
        <View onLayout={(event) => { layout.current.fields.amount = event.nativeEvent.layout.y; }} style={styles.field}>
          {label(t('scan.total'), 'total')}
          <Pressable accessible={false} onPress={() => amountInput.current?.focus()} style={[styles.amountControl, { backgroundColor: tokens.cardElevated, borderColor: errors.amount ? tokens.cardErrorText : tokens.border }]}>
            <Text style={[styles.prefix, { color: tokens.cardMutedText }]}>RM</Text>
            <TextInput ref={amountInput} testID="scan-total" value={draft.amountText} keyboardType="decimal-pad"
              onChangeText={(value) => { draft.setAmountText(value); markEdited('total'); }}
              placeholder={flagged('total') && !draft.amountText ? t('scan.notFound') : '0.00'} placeholderTextColor={tokens.cardMutedText}
              selectionColor={tokens.brandCyan} accessibilityLabel={a11y(t('scan.total'), 'total')} style={[styles.amountInput, { color: tokens.cardText }]} />
          </Pressable>
          {errors.amount && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{errors.amount}</Text>}
        </View>
        {divider}
        <View onLayout={(event) => { layout.current.fields.category = event.nativeEvent.layout.y; }} style={styles.field}>
          {draft.suggestion.visible && <CategorySuggestion state={draft.suggestion.state} onUse={draft.suggestion.use} onDismiss={draft.suggestion.dismiss} />}
          <SelectionField variant="row" label={t('expense.category')} labelOnCard value={draft.category} placeholder={t('expense.categoryPlaceholder')} options={categoryOptions}
            onSelect={(id) => draft.setCategory(id as ExpenseCategory)} error={errors.category} testID="scan-category" />
        </View>
        {divider}
        {noteOpen ? <ExpenseTextField label={t('expense.notes')} value={draft.notes} onChangeText={draft.setNotes} placeholder={t('expense.notesPlaceholder')} multiline maxLength={1000} />
          : <Pressable testID="scan-add-note" accessibilityRole="button" onPress={() => setNoteOpen(true)} style={styles.noteRow}>
            <Ionicons name="add" size={18} color={tokens.pageAccent} /><Text style={[styles.link, { color: tokens.pageAccent }]}>{t('scan.addNote')}</Text>
          </Pressable>}
      </View>

      {result.items.length > 0 && <ReceiptItemsCard items={items} totalAmount={parseExpenseAmount(draft.amountText)} incomplete={flags.itemsIncomplete} onChange={setItems} />}

      <Pressable testID="scan-view-text" accessibilityRole="button" onPress={() => setTextOpen(true)} style={styles.textLink}>
        <Ionicons name="document-text-outline" size={17} color={tokens.pageAccent} />
        <Text style={[styles.link, { color: tokens.pageAccent }]}>{t('scan.viewText')}</Text>
      </Pressable>
    </ScrollView>

    {/* Fixed outside the scroll area so it stays visible; hidden while typing so it never rides over a field. */}
    <View testID="scan-save-footer" style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.space3) + spacing.space2, backgroundColor: tokens.screenBackground }, keyboardVisible && !draft.saving && styles.hidden]}>
      {draft.saveError && <Text style={[styles.saveError, { color: tokens.errorText }]} accessibilityRole="alert">{draft.saveError}</Text>}
      {draft.saving && <Text style={[styles.saving, { color: tokens.mutedText }]} accessibilityLiveRegion="polite">{t('scan.saving')}</Text>}
      <PrimaryButton onPress={() => { void save(); }} loading={draft.saving}>{t('scan.save')}</PrimaryButton>
    </View>
    <DetectedTextSheet visible={textOpen} text={result.rawText} onClose={() => setTextOpen(false)} />
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.space6, paddingBottom: spacing.space6, gap: spacing.space3, width: '100%', maxWidth: 568, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.space1, marginLeft: -spacing.space2 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.screenTitle, flex: 1 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space4, gap: spacing.space3 },
  heading: { ...typography.label },
  noticeBlock: { gap: spacing.space3 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2 },
  retake: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.space2, borderWidth: 1, borderRadius: radius.radiusFull, paddingHorizontal: spacing.space4 },
  retakeText: { ...typography.label, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  noticeText: { ...typography.label, fontWeight: '500', lineHeight: 19, flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  field: { gap: spacing.space2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.space2 },
  fieldLabel: { ...typography.label },
  input: { ...typography.body, borderWidth: 1, borderRadius: radius.radiusMd, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3 },
  merchant: { minHeight: 50, lineHeight: 22, textAlignVertical: 'top' },
  amountControl: { minHeight: 56, borderRadius: radius.radiusMd, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.space4, gap: spacing.space2 },
  prefix: { ...typography.body, fontWeight: '700' },
  amountInput: { ...typography.sectionTitle, flex: 1, minHeight: 52, paddingVertical: spacing.space2 },
  error: { ...typography.label },
  noteRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space1 },
  link: { ...typography.label, fontSize: 14 },
  textLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space1 },
  footer: { paddingHorizontal: spacing.space6, paddingTop: spacing.space3, gap: spacing.space2, width: '100%', maxWidth: 568, alignSelf: 'center' },
  hidden: { display: 'none' },
  saveError: { ...typography.label, lineHeight: 19, textAlign: 'center' },
  saving: { ...typography.label, textAlign: 'center' },
});
