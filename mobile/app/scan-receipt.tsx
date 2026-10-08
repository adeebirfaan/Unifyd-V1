import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ExpenseForm } from '@/components/wallet/ExpenseForm';
import type { TranslationKey } from '@/constants/i18n';
import { radius, spacing, typography } from '@/constants/theme';
import type { ExpenseInput } from '@/lib/expenseForm';
import { formatExpenseDate, formatRinggit } from '@/lib/expenseHistory';
import { ReceiptOcrError, scanReceipt } from '@/lib/receiptOcr';
import type { ReceiptOcrErrorCode, ReceiptOcrResult } from '@/lib/receiptOcr';
import { supabase } from '@/lib/supabase';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useI18n } from '@/providers/LanguageProvider';

const errorKeys: Record<ReceiptOcrErrorCode, TranslationKey> = {
  notConfigured: 'scan.notConfigured', invalidImage: 'scan.invalidImage', tooLarge: 'scan.tooLarge',
  authRequired: 'scan.authRequired', unavailable: 'scan.unavailable',
};
const warningKeys: Record<string, TranslationKey> = {
  'No readable text was detected.': 'scan.warningNoText',
  'Merchant name needs review.': 'scan.warningMerchant',
  'Purchase date needs review.': 'scan.warningDate',
  'Total amount needs review.': 'scan.warningTotal',
};

export default function ScanReceiptScreen() {
  const { budgetPeriod } = useLocalSearchParams<{ budgetPeriod?: string }>();
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const insets = useSafeAreaInsets();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [result, setResult] = useState<ReceiptOcrResult | null>(null);
  const [picking, setPicking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  async function selectImage(source: 'camera' | 'library') {
    if (picking || scanning) return;
    setPicking(true);
    setErrorKey(null);
    try {
      if (source === 'camera' && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setErrorKey('scan.cameraDenied'); return; }
      }
      const picked = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, allowsMultipleSelection: false });
      if (!picked.canceled && picked.assets[0]) {
        setAsset(picked.assets[0]);
        setResult(null);
        if ((picked.assets[0].fileSize ?? picked.assets[0].file?.size ?? 0) > 5 * 1024 * 1024) setErrorKey('scan.tooLarge');
      }
    } catch {
      setErrorKey('scan.pickError');
    } finally {
      setPicking(false);
    }
  }

  async function extract() {
    if (!asset || scanning || picking) return;
    setScanning(true);
    setErrorKey(null);
    setResult(null);
    try {
      setResult(await scanReceipt(asset));
    } catch (error) {
      setErrorKey(error instanceof ReceiptOcrError ? errorKeys[error.code] : 'scan.unavailable');
    } finally {
      setScanning(false);
    }
  }

  async function saveExpense(input: ExpenseInput): Promise<boolean> {
    if (!session) return false;
    try {
      const { data, error } = await supabase.from('expenses').insert({
        user_id: session.user.id,
        title: input.title,
        amount: input.amount,
        category: input.category,
        expense_date: input.expense_date,
        notes: input.notes,
        entry_source: 'ocr',
      }).select('id').single();
      if (error || !data) return false;
      router.replace({ pathname: '/(tabs)/wallet', params: { saved: '1', budgetPeriod: budgetPeriod === 'weekly' ? 'weekly' : 'monthly' } });
      return true;
    } catch {
      return false;
    }
  }

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tokens.screenBackground }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]}>
    <View style={styles.inner}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={tokens.screenText} />
      </Pressable>
      <Text style={[styles.eyebrow, { color: tokens.pageAccent }]}>{t('wallet.eyebrow')}</Text>
      <Text style={[styles.title, { color: tokens.screenText }]}>{t('scan.title')}</Text>
      <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('scan.helper')}</Text>

      <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        {asset ? <>
          <Text style={[styles.cardLabel, { color: tokens.cardMutedText }]}>{t('scan.selected')}</Text>
          <Image source={{ uri: asset.uri }} style={[styles.preview, { backgroundColor: tokens.cardElevated }]} resizeMode="contain" accessibilityLabel={t('scan.selected')} />
        </> : <View style={[styles.emptyImage, { backgroundColor: tokens.cardElevated }]}><Ionicons name="receipt-outline" size={42} color={tokens.brandCyan} /></View>}
        <View style={styles.choices}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: picking || scanning }} disabled={picking || scanning} onPress={() => { void selectImage('camera'); }} style={[styles.choice, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
            <Ionicons name="camera-outline" size={20} color={tokens.cardText} /><Text style={[styles.choiceText, { color: tokens.cardText }]}>{t('scan.camera')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: picking || scanning }} disabled={picking || scanning} onPress={() => { void selectImage('library'); }} style={[styles.choice, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
            <Ionicons name="images-outline" size={20} color={tokens.cardText} /><Text style={[styles.choiceText, { color: tokens.cardText }]}>{t('scan.library')}</Text>
          </Pressable>
        </View>
        {errorKey && <Text accessibilityRole="alert" style={[styles.error, { color: tokens.cardErrorText }]}>{t(errorKey)}</Text>}
        <PrimaryButton onPress={() => { void extract(); }} disabled={!asset || picking} loading={scanning}>{scanning ? t('scan.scanning') : t('scan.scan')}</PrimaryButton>
      </View>

      {result && <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <Text style={[styles.section, { color: tokens.cardText }]}>{t('scan.draftTitle')}</Text>
        <Text style={[styles.note, { color: tokens.cardMutedText }]}>{t('scan.draftNote')}</Text>
        <ResultRow label={t('scan.merchant')} value={result.merchantName ?? t('scan.notDetected')} />
        <ResultRow label={t('scan.date')} value={result.purchaseDate ? formatExpenseDate(result.purchaseDate, language) : t('scan.notDetected')} />
        <ResultRow label={t('scan.total')} value={result.totalAmount !== null ? formatRinggit(result.totalAmount) : t('scan.notDetected')} />
        {result.warnings.length > 0 && <View style={styles.textBlock}>
          <Text style={[styles.cardLabel, { color: tokens.brandCyan }]}>{t('scan.warnings')}</Text>
          {result.warnings.map((warning, index) => <Text key={`${index}-${warning}`} style={[styles.note, { color: tokens.cardMutedText }]}>{t(warningKeys[warning] ?? 'scan.warningOther')}</Text>)}
        </View>}
      </View>}
      {result && <>
        <Text style={[styles.section, styles.reviewTitle, { color: tokens.screenText }]}>{t('scan.reviewTitle')}</Text>
        <Text style={[styles.helper, { color: tokens.mutedText }]}>{t('scan.reviewHelper')}</Text>
        <ExpenseForm
          initial={{ title: result.merchantName ?? '', amount: result.totalAmount === null ? '' : String(result.totalAmount), category: null, expenseDate: result.purchaseDate ?? '', notes: '' }}
          onSave={saveExpense}
          submitKey="scan.saveExpense"
          savingKey="scan.savingExpense"
          errorKey="scan.saveError"
        />
        <View style={[styles.card, styles.rawCard, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          <Text style={[styles.cardLabel, { color: tokens.brandCyan }]}>{t('scan.rawText')}</Text>
          <Text selectable style={[styles.rawText, { color: tokens.cardMutedText }]}>{result.rawText || t('scan.notDetected')}</Text>
        </View>
      </>}
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/add-expense', params: { budgetPeriod: budgetPeriod === 'weekly' ? 'weekly' : 'monthly' } })} style={styles.manual}>
        <Text style={[styles.manualText, { color: tokens.pageAccent }]}>{t('scan.manual')}</Text>
      </Pressable>
    </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function ResultRow({ label, value }: { label: string; value: string }) {
  const { tokens } = useAppearance();
  return <View style={[styles.resultRow, { borderTopColor: tokens.border }]}><Text style={[styles.cardLabel, { color: tokens.cardMutedText }]}>{label}</Text><Text style={[styles.resultValue, { color: tokens.cardText }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.space6 }, inner: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.space5 },
  eyebrow: { ...typography.label, letterSpacing: 2, marginBottom: spacing.space2 },
  title: { ...typography.screenTitle, marginBottom: spacing.space2 },
  helper: { ...typography.body, lineHeight: 23, marginBottom: spacing.space6 },
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space4, marginBottom: spacing.space4 },
  emptyImage: { height: 160, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', height: 220, borderRadius: radius.radiusMd },
  choices: { flexDirection: 'row', gap: spacing.space3 },
  choice: { minHeight: 54, flex: 1, borderWidth: 1, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', gap: spacing.space1, padding: spacing.space2 },
  choiceText: { ...typography.label, textAlign: 'center' },
  cardLabel: { ...typography.label }, section: { ...typography.sectionTitle }, note: { ...typography.body, lineHeight: 22 },
  error: { ...typography.body, lineHeight: 22 },
  resultRow: { borderTopWidth: 1, paddingTop: spacing.space3, gap: spacing.space1 }, resultValue: { ...typography.body, fontWeight: '600' },
  textBlock: { gap: spacing.space2 }, rawText: { ...typography.body, lineHeight: 22 },
  reviewTitle: { marginBottom: spacing.space2 }, rawCard: { marginTop: spacing.space4 },
  manual: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, manualText: { ...typography.body, fontWeight: '600' },
});
