import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';

import { ConfirmDialog } from '@/components/finance/ConfirmDialog';
import { ScanReading } from '@/components/scan/ScanReading';
import { ScanReview } from '@/components/scan/ScanReview';
import { ScanStart } from '@/components/scan/ScanStart';
import type { TranslationKey } from '@/constants/i18n';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { ExpenseInput } from '@/lib/expenseForm';
import { ReceiptImageError } from '@/lib/receiptImage';
import type { ReceiptImage } from '@/lib/receiptImage';
import { prepareReceiptImage } from '@/lib/receiptImageTools';
import { ReceiptOcrError, scanReceipt } from '@/lib/receiptOcr';
import type { ReceiptOcrErrorCode, ReceiptOcrResult } from '@/lib/receiptOcr';
import { READING_SLOW_MS, remainingMinimumMs } from '@/lib/scanFlow';
import { formatScanTiming } from '@/lib/scanTiming';
import type { PrepareTiming, UploadTiming } from '@/lib/scanTiming';
import { supabase } from '@/lib/supabase';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useI18n } from '@/providers/LanguageProvider';

const errorKeys: Record<ReceiptOcrErrorCode, TranslationKey> = {
  notConfigured: 'scan.notConfigured', invalidImage: 'scan.invalidImage', tooLarge: 'scan.tooLarge',
  authRequired: 'scan.authRequired', unavailable: 'scan.unavailable', network: 'scan.networkError',
  timeout: 'scan.timeout', cancelled: 'scan.unavailable',
};
// Sending the same prepared photo again can help with these; the others need another photo or a sign-in.
const RETRYABLE = new Set<ReceiptOcrErrorCode>(['unavailable', 'network', 'timeout']);
const wait = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });
// Stage timing in the Metro log (durations and sizes only). Development builds only, and only with EXPO_PUBLIC_SCAN_TIMING=1.
const SCAN_TIMING = __DEV__ && process.env.EXPO_PUBLIC_SCAN_TIMING === '1';

type Step = 'start' | 'reading' | 'review';
type ScanError = { key: TranslationKey; canRetry: boolean };

/**
 * Receipt scan flow (design system "Receipt scan flow"): Start → Reading → Review on one route. Every picked photo,
 * from the camera or the library, is prepared on the device (upright JPEG, ≤ 2400 px, ≤ 5 MB) before upload.
 * Reading stays at least 1.2 s and offers Retry and Enter manually after 20 s. Nothing is saved until Save expense.
 */
export default function ScanReceiptScreen() {
  const { budgetPeriod } = useLocalSearchParams<{ budgetPeriod?: string }>();
  const period = budgetPeriod === 'weekly' ? 'weekly' : 'monthly';
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<Step>('start');
  const [phase, setPhase] = useState<'preparing' | 'reading'>('preparing');
  const [slow, setSlow] = useState(false);
  const [picking, setPicking] = useState(false);
  const [image, setImage] = useState<ReceiptImage | null>(null);
  const [result, setResult] = useState<ReceiptOcrResult | null>(null);
  const [error, setError] = useState<ScanError | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  // The current Reading run. A newer run (Retry, Cancel, leaving) makes every older reply stale.
  const run = useRef<{ id: number; controller: AbortController | null; slowTimer: ReturnType<typeof setTimeout> | null }>({ id: 0, controller: null, slowTimer: null });
  // The current run's stage timings (only filled in when SCAN_TIMING is on).
  const timing = useRef<{ prepare?: PrepareTiming & { totalMs: number }; upload?: UploadTiming }>({});

  const stopRun = useCallback(() => {
    run.current.id += 1;
    run.current.controller?.abort();
    run.current.controller = null;
    if (run.current.slowTimer) clearTimeout(run.current.slowTimer);
    run.current.slowTimer = null;
  }, []);
  useEffect(() => stopRun, [stopRun]);

  function beginReading(nextPhase: 'preparing' | 'reading') {
    stopRun();
    timing.current = {};
    const id = run.current.id;
    setError(null); setSlow(false); setPhase(nextPhase); setStep('reading');
    run.current.slowTimer = setTimeout(() => { if (run.current.id === id) setSlow(true); }, READING_SLOW_MS);
    return { id, startedAt: Date.now() };
  }

  /** Shows the outcome once Reading has been visible for its minimum time, unless a newer run took over. */
  async function finish(id: number, startedAt: number, show: () => void, outcome: string) {
    const minWaitMs = remainingMinimumMs(startedAt, Date.now());
    await wait(minWaitMs);
    if (run.current.id !== id) return;
    if (SCAN_TIMING) console.info(formatScanTiming({ ...timing.current, minWaitMs, totalMs: Date.now() - startedAt, outcome }));
    if (run.current.slowTimer) clearTimeout(run.current.slowTimer);
    run.current.slowTimer = null;
    run.current.controller = null;
    setSlow(false);
    show();
  }

  async function read(prepared: ReceiptImage, id: number, startedAt: number) {
    setPhase('reading');
    const controller = new AbortController();
    run.current.controller = controller;
    try {
      const scanned = await scanReceipt(prepared, { signal: controller.signal, onTiming: SCAN_TIMING ? (upload) => { timing.current.upload = upload; } : undefined });
      await finish(id, startedAt, () => { setResult(scanned); setStep('review'); }, 'ok');
    } catch (caught) {
      const code = caught instanceof ReceiptOcrError ? caught.code : 'unavailable';
      if (code === 'cancelled') return;
      await finish(id, startedAt, () => { setError({ key: errorKeys[code], canRetry: RETRYABLE.has(code) }); setStep('start'); }, `error:${code}`);
    }
  }

  async function pick(source: 'camera' | 'library') {
    if (picking) return;
    setError(null);
    setPicking(true);
    let picked: ImagePicker.ImagePickerResult;
    try {
      if (source === 'camera' && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setError({ key: 'scan.cameraDenied', canRetry: false }); return; }
      }
      picked = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, allowsMultipleSelection: false });
    } catch {
      setError({ key: 'scan.pickError', canRetry: false });
      return;
    } finally {
      setPicking(false);
    }
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    setImage(null); setResult(null);
    const { id, startedAt } = beginReading('preparing');
    let prepared: ReceiptImage;
    try {
      // Camera and library photos (often HEIC and over 5 MB) become an upright JPEG before any check or upload.
      const prepareStart = Date.now();
      prepared = await prepareReceiptImage(asset.uri, {
        size: { width: asset.width, height: asset.height },
        onTiming: SCAN_TIMING ? (prepare) => { timing.current.prepare = { ...prepare, totalMs: Date.now() - prepareStart }; } : undefined,
      });
    } catch (caught) {
      const key: TranslationKey = caught instanceof ReceiptImageError && caught.code === 'tooLarge' ? 'scan.tooLarge' : 'scan.prepareError';
      await finish(id, startedAt, () => { setError({ key, canRetry: false }); setStep('start'); }, 'error:prepare');
      return;
    }
    if (run.current.id !== id) return;
    setImage(prepared);
    await read(prepared, id, startedAt);
  }

  function retry() {
    if (!image) return;
    const { id, startedAt } = beginReading('reading');
    void read(image, id, startedAt);
  }

  function cancelReading() {
    stopRun();
    setSlow(false);
    setStep('start');
  }

  function enterManually() {
    cancelReading();
    router.push({ pathname: '/add-expense', params: { budgetPeriod: period } });
  }

  function discard() {
    setDiscardOpen(false);
    setResult(null); setImage(null); setStep('start');
  }

  // Android back follows the steps: Reading cancels, Review asks before discarding.
  useEffect(() => {
    if (step === 'start') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'reading') { stopRun(); setSlow(false); setStep('start'); } else setDiscardOpen(true);
      return true;
    });
    return () => subscription.remove();
  }, [step, stopRun]);

  async function saveExpense(input: ExpenseInput): Promise<boolean> {
    if (!session) return false;
    try {
      const { data, error: saveError } = await supabase.from('expenses').insert({
        user_id: session.user.id,
        title: input.title,
        amount: input.amount,
        category: input.category,
        expense_date: input.expense_date,
        notes: input.notes,
        entry_source: 'ocr',
      }).select('id').single();
      if (saveError || !data) return false;
      router.replace({ pathname: '/(tabs)/wallet', params: { saved: '1', budgetPeriod: period } });
      return true;
    } catch {
      return false;
    }
  }

  return <View style={[styles.fill, { backgroundColor: tokens.screenBackground }]}>
    {/* The iOS swipe back would drop a scan in progress or a draft, so it works only on Start. */}
    <Stack.Screen options={{ gestureEnabled: step === 'start' }} />
    {step === 'start' && <ScanStart busy={picking} error={error ? { message: t(error.key), canRetry: error.canRetry && !!image } : null}
      onBack={() => router.back()} onCamera={() => { void pick('camera'); }} onLibrary={() => { void pick('library'); }}
      onManual={() => router.push({ pathname: '/add-expense', params: { budgetPeriod: period } })} onRetry={retry} />}
    {step === 'reading' && <ScanReading phase={phase} slow={slow} reduceMotion={reduceMotion} onCancel={cancelReading} onRetry={retry} onManual={enterManually} />}
    {step === 'review' && result && image && <ScanReview imageUri={image.uri} result={result} onSave={saveExpense} onBack={() => setDiscardOpen(true)} onRetake={discard} />}
    <ConfirmDialog visible={discardOpen} title={t('scan.discardTitle')} body={t('scan.discardBody')} confirmLabel={t('scan.discard')} cancelLabel={t('scan.keepReviewing')}
      busy={false} destructive onConfirm={discard} onCancel={() => setDiscardOpen(false)} testID="scan-discard" />
  </View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
