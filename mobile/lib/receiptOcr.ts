import Constants from 'expo-constants';
import { File, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';

import type { ReceiptImage } from '@/lib/receiptImage';
import { receiptItems } from '@/lib/scanFlow';
import type { ReceiptItem } from '@/lib/scanFlow';
import { supabase } from '@/lib/supabase';

export type ReceiptOcrResult = {
  merchantName: string | null;
  purchaseDate: string | null;
  totalAmount: number | null;
  rawText: string;
  warnings: string[];
  /** Optional receipt lines (planned server field). Missing or malformed items become an empty list. */
  items: ReceiptItem[];
};

/**
 * `network`: the photo could not be uploaded (no connection or the server could not be reached).
 * `unavailable`: the server answered but could not read the receipt. `timeout`: no answer within 45 s.
 * `cancelled`: the student cancelled, so nothing is shown.
 */
export type ReceiptOcrErrorCode = 'notConfigured' | 'invalidImage' | 'tooLarge' | 'authRequired' | 'unavailable' | 'network' | 'timeout' | 'cancelled';
export class ReceiptOcrError extends Error {
  constructor(public readonly code: ReceiptOcrErrorCode) { super(code); }
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Base URL of the Unifyd server (OCR and dashboard insights). */
export function ocrBaseUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_OCR_API_URL?.trim();
  if (!configured) return null;
  const url = new URL(configured);
  // Expo Go knows the computer's current LAN address. Follow it during local
  // development so changing Wi-Fi does not leave OCR pointed at an old adapter.
  const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
  const localAddress = /^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  if (__DEV__ && Platform.OS !== 'web' && metroHost && localAddress.test(url.hostname) && localAddress.test(metroHost)) {
    url.hostname = metroHost;
  }
  return url.toString().replace(/\/$/, '');
}

function isResult(value: unknown): value is Omit<ReceiptOcrResult, 'items'> & { items?: unknown } {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<ReceiptOcrResult>;
  return (result.merchantName === null || typeof result.merchantName === 'string')
    && (result.purchaseDate === null || typeof result.purchaseDate === 'string')
    && (result.totalAmount === null || (typeof result.totalAmount === 'number' && Number.isFinite(result.totalAmount)))
    && typeof result.rawText === 'string'
    && Array.isArray(result.warnings) && result.warnings.every((warning) => typeof warning === 'string');
}

/**
 * Uploads a photo already prepared by `prepareReceiptImage` (an upright JPEG named receipt.jpg).
 * `signal` cancels the request (Back or Retry during Reading); it then fails with `cancelled`.
 */
export async function scanReceipt(image: ReceiptImage, { signal }: { signal?: AbortSignal } = {}): Promise<ReceiptOcrResult> {
  const baseUrl = ocrBaseUrl();
  if (!baseUrl) throw new ReceiptOcrError('notConfigured');
  const mime = image.mimeType;
  if (!ACCEPTED_TYPES.has(mime)) throw new ReceiptOcrError('invalidImage');
  if (image.size > MAX_IMAGE_BYTES) throw new ReceiptOcrError('tooLarge');

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new ReceiptOcrError('authRequired');
  if (signal?.aborted) throw new ReceiptOcrError('cancelled');

  const name = image.fileName;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel);
  // A failure while sending is a cancellation, a timeout, or an upload (network) problem; never a reading failure.
  const sendFailed = () => new ReceiptOcrError(signal?.aborted ? 'cancelled' : timedOut ? 'timeout' : 'network');
  try {
    let status: number;
    let body: unknown;
    if (Platform.OS === 'web') {
      const form = new FormData();
      const blob: Blob = image.file ? image.file : await (await fetch(image.uri)).blob();
      if (blob.size > MAX_IMAGE_BYTES) throw new ReceiptOcrError('tooLarge');
      // The type is set explicitly so the multipart part says image/jpeg, matching the bytes the server checks.
      form.append('image', blob.type === mime ? blob : new Blob([blob], { type: mime }), name);
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/ocr/receipt`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          body: form,
          signal: controller.signal,
        });
      } catch {
        throw sendFailed();
      }
      status = response.status;
      if (response.ok) body = await response.json();
    } else {
      // Expo's native uploader reads the prepared JPEG directly and builds
      // multipart data without React Native's fragile file-URI FormData bridge.
      const file = new File(image.uri);
      if (!file.exists || file.size === 0) throw new ReceiptOcrError('invalidImage');
      if (file.size > MAX_IMAGE_BYTES) throw new ReceiptOcrError('tooLarge');
      let upload: Awaited<ReturnType<typeof file.upload>>;
      try {
        upload = await file.upload(`${baseUrl}/api/ocr/receipt`, {
          httpMethod: 'POST', uploadType: UploadType.MULTIPART, fieldName: 'image', mimeType: mime,
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          signal: controller.signal,
        });
      } catch {
        throw sendFailed();
      }
      status = upload.status;
      if (status >= 200 && status < 300) body = JSON.parse(upload.body);
    }
    if (signal?.aborted) throw new ReceiptOcrError('cancelled');
    if (status === 401) throw new ReceiptOcrError('authRequired');
    if (status === 413) throw new ReceiptOcrError('tooLarge');
    if (status === 415 || status === 400) throw new ReceiptOcrError('invalidImage');
    if (status < 200 || status >= 300) throw new ReceiptOcrError('unavailable');
    if (!isResult(body)) throw new ReceiptOcrError('unavailable');
    const { merchantName, purchaseDate, totalAmount, rawText, warnings } = body;
    return { merchantName, purchaseDate, totalAmount, rawText, warnings, items: receiptItems(body.items) };
  } catch (error) {
    if (signal?.aborted) throw new ReceiptOcrError('cancelled');
    if (error instanceof ReceiptOcrError) throw error;
    // The server answered, but the reply could not be read.
    throw new ReceiptOcrError('unavailable');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
