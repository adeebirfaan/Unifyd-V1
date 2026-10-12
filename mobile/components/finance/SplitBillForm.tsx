import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { SelectionField } from '@/components/profile/SelectionField';
import { ExpenseDatePicker } from '@/components/wallet/ExpenseDatePicker';
import { ExpenseTextField } from '@/components/wallet/ExpenseTextField';
import { radius, spacing, typography } from '@/constants/theme';
import { EXPENSE_CATEGORIES, isValidISODate, localDateISO, parseExpenseAmount } from '@/lib/expenseForm';
import type { ExpenseCategory } from '@/lib/expenseForm';
import { formatRinggit } from '@/lib/expenseHistory';
import { MAX_PEOPLE, MIN_PEOPLE, assignedCents, equalShares, inferSplitMethod, orderParticipants, splitIssues, toCents } from '@/lib/splitBills';
import type { ShareDraft, SplitBillRecord, SplitMethod } from '@/lib/splitBills';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type Person = { key: string; id?: string; name: string; amountText: string; isSelf: boolean; isSettled: boolean; settledAt: string | null };
export type SplitPersonInput = { id?: string; name: string; shareCents: number; isSelf: boolean; isSettled: boolean; settledAt: string | null };
export type SplitBillInput = {
  bill: { title: string; total_amount: number; bill_date: string; category: ExpenseCategory | null; notes: string | null };
  people: SplitPersonInput[];
};
export type SplitSaveResult = 'saved' | 'error' | 'partial';
type FieldErrors = Partial<Record<'title' | 'total' | 'date' | 'split', string>>;
const NO_CATEGORY = 'none';
// Stored for the self row; the app always shows the translated "You" instead.
export const SELF_NAME = 'You';
const cents = (text: string) => { const amount = parseExpenseAmount(text); return amount === null ? null : Math.round(amount * 100); };

function initialPeople(bill?: SplitBillRecord): Person[] {
  if (!bill) return [
    { key: 'self', name: SELF_NAME, amountText: '', isSelf: true, isSettled: true, settledAt: null },
    { key: 'p1', name: '', amountText: '', isSelf: false, isSettled: false, settledAt: null },
  ];
  return orderParticipants(bill.split_bill_participants).map((participant) => ({
    key: participant.id, id: participant.id, name: participant.is_self ? SELF_NAME : participant.participant_name,
    amountText: Number(participant.share_amount).toFixed(2), isSelf: participant.is_self, isSettled: participant.is_settled, settledAt: participant.settled_at,
  }));
}

export function SplitBillForm({ initial, onSave }: { initial?: SplitBillRecord; onSave: (input: SplitBillInput) => Promise<SplitSaveResult> }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [totalText, setTotalText] = useState(initial ? Number(initial.total_amount).toFixed(2) : '');
  const [billDate, setBillDate] = useState(initial?.bill_date ?? localDateISO());
  const [category, setCategory] = useState<ExpenseCategory | null>(initial?.category ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [people, setPeople] = useState<Person[]>(() => initialPeople(initial));
  const [method, setMethod] = useState<SplitMethod>(() => initial ? inferSplitMethod(toCents(initial.total_amount), initialPeople(initial).map((person) => cents(person.amountText) ?? 0)) : 'equal');
  const [showErrors, setShowErrors] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SplitSaveResult | null>(null);
  const nextKey = useRef(people.length + 1);

  const totalCents = cents(totalText);
  const equal = totalCents !== null ? equalShares(totalCents, people.length) : null;
  const drafts: ShareDraft[] = people.map((person, index) => ({ name: person.isSelf ? SELF_NAME : person.name, isSelf: person.isSelf, shareCents: method === 'equal' ? equal?.[index] ?? null : cents(person.amountText) }));
  const issues = splitIssues(totalCents, drafts);
  const personError = (index: number) => {
    if (!showErrors) return {};
    const own = issues.filter((issue) => 'index' in issue && issue.index === index);
    return {
      name: own.some((issue) => issue.kind === 'nameRequired') ? t('split.nameRequired') : own.some((issue) => issue.kind === 'duplicateName') ? t('split.duplicateName') : undefined,
      share: method === 'custom' && own.some((issue) => issue.kind === 'shareInvalid') ? t('split.shareInvalid') : undefined,
    };
  };
  const remaining = totalCents !== null ? totalCents - assignedCents(drafts) : null;

  function updatePerson(index: number, change: Partial<Person>) {
    setPeople((current) => current.map((person, i) => i === index ? { ...person, ...change } : person));
    setSaveResult(null);
  }

  function changeCount(delta: number) {
    setPeople((current) => {
      if (delta > 0 && current.length < MAX_PEOPLE) return [...current, { key: `p${nextKey.current++}`, name: '', amountText: '', isSelf: false, isSettled: false, settledAt: null }];
      if (delta < 0 && current.length > MIN_PEOPLE) return current.slice(0, -1);
      return current;
    });
  }

  function chooseMethod(next: SplitMethod) {
    // Switching to custom starts from the equal shares, so the student only adjusts what differs.
    if (next === 'custom' && method === 'equal' && equal) setPeople((current) => current.map((person, index) => ({ ...person, amountText: (equal[index] / 100).toFixed(2) })));
    setMethod(next);
  }

  async function submit() {
    if (saving) return;
    const parsedTotal = parseExpenseAmount(totalText);
    const next: FieldErrors = {
      title: title.trim() ? undefined : t('split.titleRequired'),
      total: !totalText.trim() ? t('split.totalRequired') : parsedTotal === null ? t('split.totalInvalid') : undefined,
      date: isValidISODate(billDate) ? undefined : t('split.dateRequired'),
      split: method === 'equal' && totalCents !== null && !equal ? t('split.equalTooSmall')
        : issues.some((issue) => issue.kind === 'totalMismatch') ? t('split.mismatchError') : undefined,
    };
    setErrors(next);
    setShowErrors(true);
    setSaveResult(null);
    if (Object.values(next).some(Boolean) || issues.length || parsedTotal === null) return;
    setSaving(true);
    try {
      const result = await onSave({
        bill: { title: title.trim(), total_amount: parsedTotal, bill_date: billDate, category, notes: notes.trim() || null },
        people: people.map((person, index) => ({ id: person.id, name: person.isSelf ? SELF_NAME : person.name.trim(), shareCents: drafts[index].shareCents!, isSelf: person.isSelf, isSettled: person.isSelf || person.isSettled, settledAt: person.settledAt })),
      });
      if (result !== 'saved') setSaveResult(result);
    } catch { setSaveResult('error'); }
    finally { setSaving(false); }
  }

  const fieldColors = { backgroundColor: tokens.cardElevated, borderColor: tokens.border };
  return <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <ExpenseTextField label={t('split.billTitle')} value={title} onChangeText={(value) => { setTitle(value); setErrors((current) => ({ ...current, title: undefined })); }} placeholder={t('split.billTitlePlaceholder')} maxLength={120} error={errors.title} />
    <ExpenseTextField label={t('split.total')} value={totalText} onChangeText={(value) => { setTotalText(value); setErrors((current) => ({ ...current, total: undefined, split: undefined })); }} placeholder="0.00" prefix="RM" keyboardType="decimal-pad" error={errors.total} />
    <ExpenseDatePicker value={billDate} onChange={(value) => { setBillDate(value); setErrors((current) => ({ ...current, date: undefined })); }} error={errors.date} label={t('split.date')} pickerTitle={t('split.datePicker')} />
    <SelectionField label={t('split.category')} labelOnCard value={category ?? NO_CATEGORY} placeholder={t('split.categoryNone')} options={[{ id: NO_CATEGORY, label: t('split.categoryNone') }, ...EXPENSE_CATEGORIES.map((id) => ({ id, label: t(`expense.category.${id}`) }))]} onSelect={(id) => setCategory(id === NO_CATEGORY ? null : id as ExpenseCategory)} />
    <ExpenseTextField label={t('split.notes')} value={notes} onChangeText={setNotes} placeholder={t('split.notesPlaceholder')} multiline maxLength={1000} />

    <View style={styles.group}>
      <Text style={[styles.label, { color: tokens.cardText }]}>{t('split.peopleCount')}</Text>
      <View style={styles.stepper}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('split.fewerPeople')} accessibilityState={{ disabled: people.length <= MIN_PEOPLE }} disabled={people.length <= MIN_PEOPLE} onPress={() => changeCount(-1)} style={[styles.stepButton, fieldColors, people.length <= MIN_PEOPLE && styles.dimmed]}><Ionicons name="remove" size={22} color={tokens.cardText} /></Pressable>
        <Text testID="split-people-count" style={[styles.stepValue, { color: tokens.cardText }]} accessibilityLiveRegion="polite">{t('split.peopleValue', { count: people.length })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('split.morePeople')} accessibilityState={{ disabled: people.length >= MAX_PEOPLE }} disabled={people.length >= MAX_PEOPLE} onPress={() => changeCount(1)} style={[styles.stepButton, fieldColors, people.length >= MAX_PEOPLE && styles.dimmed]}><Ionicons name="add" size={22} color={tokens.cardText} /></Pressable>
      </View>
      <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('split.noAccount')}</Text>
    </View>

    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={t('split.method')}>
      <Text style={[styles.label, { color: tokens.cardText }]}>{t('split.method')}</Text>
      <View style={styles.methods}>{(['equal', 'custom'] as const).map((id) => {
        const selected = method === id;
        return <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected, checked: selected }} aria-checked={selected} onPress={() => chooseMethod(id)} style={[styles.method, fieldColors, selected && { borderColor: tokens.brandCyan }]}>
          <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? tokens.brandCyan : tokens.cardMutedText} />
          <Text style={[styles.methodText, { color: tokens.cardText }]}>{t(id === 'equal' ? 'split.methodEqual' : 'split.methodCustom')}</Text>
        </Pressable>;
      })}</View>
      {method === 'equal' && <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('split.equalHint')}</Text>}
    </View>

    <View style={styles.group}>
      <Text style={[styles.label, { color: tokens.cardText }]}>{t('split.people')}</Text>
      {people.map((person, index) => {
        const error = personError(index);
        const displayName = person.isSelf ? t('split.you') : person.name.trim() || t('split.personName', { number: index + 1 });
        const share = drafts[index].shareCents;
        return <View key={person.key} testID={`split-person-${index}`} style={[styles.person, { borderColor: tokens.border }]}>
          {person.isSelf ? <View style={styles.selfRow}><Ionicons name="person-circle-outline" size={22} color={tokens.brandCyan} /><View style={styles.selfCopy}><Text style={[styles.selfName, { color: tokens.cardText }]}>{t('split.you')}</Text><Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('split.youHint')}</Text></View></View>
            : <ExpenseTextField label={t('split.personName', { number: index + 1 })} value={person.name} onChangeText={(value) => updatePerson(index, { name: value })} placeholder={t('split.personPlaceholder')} maxLength={80} error={error.name} />}
          {method === 'custom'
            ? <ExpenseTextField label={t('split.shareFor', { name: displayName })} value={person.amountText} onChangeText={(value) => updatePerson(index, { amountText: value })} placeholder="0.00" prefix="RM" keyboardType="decimal-pad" error={error.share} />
            : <Text style={[styles.share, { color: tokens.cardMutedText }]}>{share !== null ? t('split.shareOf', { amount: formatRinggit(share / 100) }) : t('split.enterTotalFirst')}</Text>}
        </View>;
      })}
      {method === 'custom' && remaining !== null && <View testID="split-remaining" style={[styles.remaining, fieldColors]} accessibilityLiveRegion="polite">
        <Ionicons name={remaining === 0 ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={20} color={remaining === 0 ? tokens.successText : tokens.brandCyan} />
        <Text style={[styles.remainingText, { color: tokens.cardText }]}>{remaining === 0 ? t('split.allAssigned', { amount: formatRinggit(totalCents! / 100) }) : remaining > 0 ? t('split.remaining', { amount: formatRinggit(remaining / 100) }) : t('split.over', { amount: formatRinggit(-remaining / 100) })}</Text>
      </View>}
      {method === 'custom' && remaining === null && <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('split.enterTotalFirst')}</Text>}
      {method === 'equal' && equal && totalCents !== null && <Text testID="split-remaining" style={[styles.hint, { color: tokens.cardMutedText }]}>{t('split.allAssigned', { amount: formatRinggit(totalCents / 100) })}</Text>}
    </View>

    {errors.split && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{errors.split}</Text>}
    {saveResult && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t(saveResult === 'partial' ? 'split.partialSaveError' : 'split.saveError')}</Text>}
    {saving && <Text style={[styles.saving, { color: tokens.cardMutedText }]} accessibilityLiveRegion="polite">{t('split.saving')}</Text>}
    <PrimaryButton onPress={() => { void submit(); }} loading={saving}>{initial ? t('split.saveChanges') : t('split.save')}</PrimaryButton>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space5 },
  group: { gap: spacing.space3 }, label: { ...typography.label }, hint: { ...typography.label, lineHeight: 19 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  stepButton: { width: 48, height: 48, borderWidth: 1, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center' }, dimmed: { opacity: 0.45 },
  stepValue: { ...typography.body, fontWeight: '700', minWidth: 96, textAlign: 'center' },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2 },
  method: { flexGrow: 1, minHeight: 48, borderWidth: 1, borderRadius: radius.radiusMd, flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingHorizontal: spacing.space3 },
  methodText: { ...typography.body, fontWeight: '600' },
  person: { borderTopWidth: 1, paddingTop: spacing.space3, gap: spacing.space3 },
  selfRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2 }, selfCopy: { flex: 1, gap: spacing.space1 }, selfName: { ...typography.body, fontWeight: '700' },
  share: { ...typography.body },
  remaining: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, borderWidth: 1, borderRadius: radius.radiusMd, padding: spacing.space3 }, remainingText: { ...typography.body, flex: 1 },
  error: { ...typography.label, lineHeight: 20 }, saving: { ...typography.label, textAlign: 'center' },
});
