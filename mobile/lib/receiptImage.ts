// Receipt photo preparation rules. Phone cameras save HEIC/HEIF and large full-resolution files, which the OCR
// server (JPEG, PNG, or WEBP up to 5 MiB) rejects, so every picked photo becomes an upright JPEG first.
// Pure: the image work is injected (lib/receiptImageTools.ts on the device), so Node tests can run it.

import type { PrepareTiming } from '@/lib/scanTiming';

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
/** Longest side after preparation. Large enough for OCR; smaller images read receipt text noticeably worse. */
export const RECEIPT_MAX_EDGE = 2400;
/** No preparation step ever shrinks a photo below this longest side. */
export const RECEIPT_MIN_EDGE = 1600;
export const RECEIPT_JPEG_QUALITY = 0.8;
/** One more, stronger compression when the first JPEG is still over the limit. */
export const RECEIPT_RETRY_QUALITY = 0.6;

export type ReceiptImage = { uri: string; width: number; height: number; size: number; mimeType: 'image/jpeg'; fileName: string; file?: Blob };
export type ReceiptImageSize = { width: number; height: number };
export type EncodedImage = ReceiptImageSize & { uri: string; size: number; file?: Blob };

/**
 * `decode` reads the photo upright (EXIF orientation applied, HEIC accepted); `encode` writes it as a JPEG,
 * resized to `size` when given, and reports the file size in bytes.
 */
export type ReceiptImageTools<Decoded extends ReceiptImageSize> = {
  decode: (uri: string) => Promise<Decoded>;
  encode: (image: Decoded, size: ReceiptImageSize | null, quality: number) => Promise<EncodedImage>;
  /** Single pass: read the file, apply orientation, resize to `size`, and save, without a separate decode. */
  encodeFile?: (uri: string, size: ReceiptImageSize | null, quality: number) => Promise<EncodedImage>;
  release?: (image: Decoded) => void;
};

export type NormalizeOptions = {
  /** The photo's upright pixel size as the picker reports it; enables the single pass. */
  size?: ReceiptImageSize;
  /** Optional, for scan timing: decode and encode durations and the result's size. */
  onTiming?: (timing: PrepareTiming) => void;
  now?: () => number;
};

export type ReceiptImageErrorCode = 'conversionFailed' | 'tooLarge';
export class ReceiptImageError extends Error {
  readonly code: ReceiptImageErrorCode;
  constructor(code: ReceiptImageErrorCode) { super(code); this.code = code; }
}

/** The size to resize to so the longest side is at most `maxEdge`, or null when the photo is already small enough (never upscaled). */
export function receiptTargetSize(width: number, height: number, maxEdge = RECEIPT_MAX_EDGE): ReceiptImageSize | null {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return null;
  const scale = Math.max(maxEdge, RECEIPT_MIN_EDGE) / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const result = (encoded: EncodedImage): ReceiptImage =>
  ({ uri: encoded.uri, width: encoded.width, height: encoded.height, size: encoded.size, mimeType: 'image/jpeg', fileName: 'receipt.jpg', file: encoded.file });

/**
 * With the photo's own size (`options.size`) and an `encodeFile` tool, the photo is read, resized, and saved in one
 * pass, to the same target size and quality as the two-pass path. Whenever that size is missing, the single pass
 * fails, or its result is not exactly the expected size, the two-pass path (decode, then encode) runs as before.
 */
export async function normalizeReceiptImage<Decoded extends ReceiptImageSize>(uri: string, tools: ReceiptImageTools<Decoded>,
  { size: given, onTiming, now = () => performance.now() }: NormalizeOptions = {}): Promise<ReceiptImage> {
  let decoded: Decoded;
  let decodeMs = 0;
  const encodeMs: number[] = [];
  const timed = async (encode: () => Promise<EncodedImage>) => {
    const start = now();
    try { return await encode(); } finally { encodeMs.push(now() - start); }
  };
  const timedEncode = (image: Decoded, size: ReceiptImageSize | null, quality: number) => timed(() => tools.encode(image, size, quality));

  const encodeFile = tools.encodeFile;
  if (encodeFile && given && given.width > 0 && given.height > 0) {
    const size = receiptTargetSize(given.width, given.height);
    const expected = size ?? given;
    let encoded: EncodedImage | null = null;
    try {
      encoded = await timed(() => encodeFile(uri, size, RECEIPT_JPEG_QUALITY));
      if (encoded.size > RECEIPT_MAX_BYTES) encoded = await timed(() => encodeFile(uri, size, RECEIPT_RETRY_QUALITY));
    } catch {
      encoded = null;
    }
    if (encoded && encoded.size > 0 && encoded.width === expected.width && encoded.height === expected.height) {
      if (encoded.size > RECEIPT_MAX_BYTES) throw new ReceiptImageError('tooLarge');
      onTiming?.({ decodeMs: 0, encodeMs, width: encoded.width, height: encoded.height, bytes: encoded.size, singlePass: true });
      return result(encoded);
    }
  }

  const decodeStart = now();
  try {
    decoded = await tools.decode(uri);
    decodeMs = now() - decodeStart;
  } catch {
    throw new ReceiptImageError('conversionFailed');
  }
  try {
    if (!(decoded.width > 0 && decoded.height > 0)) throw new ReceiptImageError('conversionFailed');
    const size = receiptTargetSize(decoded.width, decoded.height);
    let encoded: EncodedImage;
    try {
      encoded = await timedEncode(decoded, size, RECEIPT_JPEG_QUALITY);
      // Same size, lower quality: dense receipts at 2400 px are rarely this large, and the text stays readable.
      if (encoded.size > RECEIPT_MAX_BYTES) encoded = await timedEncode(decoded, size, RECEIPT_RETRY_QUALITY);
    } catch {
      throw new ReceiptImageError('conversionFailed');
    }
    if (!(encoded.size > 0)) throw new ReceiptImageError('conversionFailed');
    if (encoded.size > RECEIPT_MAX_BYTES) throw new ReceiptImageError('tooLarge');
    onTiming?.({ decodeMs, encodeMs, width: encoded.width, height: encoded.height, bytes: encoded.size, singlePass: false });
    return result(encoded);
  } finally {
    try { tools.release?.(decoded); } catch { /* releasing native memory is best effort */ }
  }
}
