// Optional stage timing for one receipt scan on the device, to see where scan time goes. Durations, image size,
// and outcome only: never image content, OCR text, tokens, or user data. Pure, so Node tests can run it.

export type PrepareTiming = { decodeMs: number; encodeMs: number[]; width: number; height: number; bytes: number };
export type UploadTiming = { sessionMs: number; requestMs: number };
export type ScanTiming = {
  prepare?: PrepareTiming & { totalMs: number };
  upload?: UploadTiming;
  /** Time Reading stayed up only to reach its 1.2 s minimum. */
  minWaitMs: number;
  totalMs: number;
  outcome: string;
};

const round = (value: number) => Math.round(value);
const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)}MB`;

/** "[scan-timing] prepare=640ms (decode=210ms encode=430ms ×1) image=1800×2400 1.21MB | session=4ms upload+server=2350ms | minWait=0ms | total=3010ms | ok" */
export function formatScanTiming(timing: ScanTiming): string {
  const parts: string[] = [];
  if (timing.prepare) {
    const { totalMs, decodeMs, encodeMs, width, height, bytes } = timing.prepare;
    parts.push(`prepare=${round(totalMs)}ms (decode=${round(decodeMs)}ms encode=${encodeMs.map(round).join('+')}ms ×${encodeMs.length}) image=${width}×${height} ${megabytes(bytes)}`);
  }
  if (timing.upload) parts.push(`session=${round(timing.upload.sessionMs)}ms upload+server=${round(timing.upload.requestMs)}ms`);
  parts.push(`minWait=${round(timing.minWaitMs)}ms`, `total=${round(timing.totalMs)}ms`, timing.outcome);
  return `[scan-timing] ${parts.join(' | ')}`;
}
