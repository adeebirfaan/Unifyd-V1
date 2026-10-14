// Optional stage timing for the receipt endpoint, to see where scan time goes. Off unless SCAN_TIMING=1.
// It records durations, the HTTP status, the image size in bytes, and whether this was the first scan since the
// server started. It never records image content, OCR text, tokens, or anything about the user.

export type ScanStage = 'auth' | 'upload' | 'vision' | 'parse' | 'items';
const STAGES: readonly ScanStage[] = ['auth', 'upload', 'vision', 'parse', 'items'];

export type ScanTimer = { stage: (name: ScanStage) => void; bytes: (count: number) => void; end: (status: number) => void };
export type ScanTimingOptions = { enabled: boolean; log?: (line: string) => void; now?: () => number };

const NOOP: ScanTimer = { stage: () => undefined, bytes: () => undefined, end: () => undefined };

/** One log line: "[scan-timing] scan=1 first=yes status=200 bytes=812345 auth=118ms upload=41ms vision=1830ms parse=4ms items=2ms total=2001ms". */
export function formatScanTiming(entry: { scan: number; status: number; bytes: number | null; stages: Partial<Record<ScanStage, number>>; total: number }): string {
  const parts = [`scan=${entry.scan}`, `first=${entry.scan === 1 ? 'yes' : 'no'}`, `status=${entry.status}`];
  if (entry.bytes !== null) parts.push(`bytes=${entry.bytes}`);
  for (const stage of STAGES) if (entry.stages[stage] !== undefined) parts.push(`${stage}=${Math.round(entry.stages[stage]!)}ms`);
  parts.push(`total=${Math.round(entry.total)}ms`);
  return `[scan-timing] ${parts.join(' ')}`;
}

/**
 * Returns a factory of per-request timers. Each `stage(name)` records the time since the previous mark (or the
 * request start) under that name; `end(status)` logs the line once. Disabled timers do nothing.
 */
export function createScanTiming({ enabled, log = (line) => console.info(line), now = () => performance.now() }: ScanTimingOptions): () => ScanTimer {
  if (!enabled) return () => NOOP;
  let scans = 0;
  return () => {
    const started = now();
    let last = started;
    let bytes: number | null = null;
    let done = false;
    const stages: Partial<Record<ScanStage, number>> = {};
    return {
      stage: (name) => { const at = now(); stages[name] = at - last; last = at; },
      bytes: (count) => { bytes = count; },
      end: (status) => {
        if (done) return;
        done = true;
        scans += 1;
        log(formatScanTiming({ scan: scans, status, bytes, stages, total: now() - started }));
      },
    };
  };
}
