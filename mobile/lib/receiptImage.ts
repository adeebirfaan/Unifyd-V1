// Receipt photo preparation rules. Phone cameras save HEIC/HEIF and large full-resolution files, which the OCR
// server (JPEG, PNG, or WEBP up to 5 MiB) rejects, so every picked photo becomes an upright JPEG first.
// Pure: the image work is injected (lib/receiptImageTools.ts on the device), so Node tests can run it.

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
  release?: (image: Decoded) => void;
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

export async function normalizeReceiptImage<Decoded extends ReceiptImageSize>(uri: string, tools: ReceiptImageTools<Decoded>): Promise<ReceiptImage> {
  let decoded: Decoded;
  try {
    decoded = await tools.decode(uri);
  } catch {
    throw new ReceiptImageError('conversionFailed');
  }
  try {
    if (!(decoded.width > 0 && decoded.height > 0)) throw new ReceiptImageError('conversionFailed');
    const size = receiptTargetSize(decoded.width, decoded.height);
    let encoded: EncodedImage;
    try {
      encoded = await tools.encode(decoded, size, RECEIPT_JPEG_QUALITY);
      // Same size, lower quality: dense receipts at 2400 px are rarely this large, and the text stays readable.
      if (encoded.size > RECEIPT_MAX_BYTES) encoded = await tools.encode(decoded, size, RECEIPT_RETRY_QUALITY);
    } catch {
      throw new ReceiptImageError('conversionFailed');
    }
    if (!(encoded.size > 0)) throw new ReceiptImageError('conversionFailed');
    if (encoded.size > RECEIPT_MAX_BYTES) throw new ReceiptImageError('tooLarge');
    return { uri: encoded.uri, width: encoded.width, height: encoded.height, size: encoded.size, mimeType: 'image/jpeg', fileName: 'receipt.jpg', file: encoded.file };
  } finally {
    try { tools.release?.(decoded); } catch { /* releasing native memory is best effort */ }
  }
}
