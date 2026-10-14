// Warms up the Google Vision client at start-up so the first receipt scan does not pay for the access token and
// connection set-up. It never sends a Vision request (nothing is billed) and never throws: if Google is unreachable,
// it logs one line and leaves the client exactly as a fresh one, so the first scan connects and retries as before.

/** The parts of `ImageAnnotatorClient` that warm-up uses. `imageAnnotatorStub` is the client's cached set-up. */
export type WarmableVisionClient = {
  auth: { getAccessToken: () => Promise<unknown> };
  initialize: () => Promise<unknown>;
  imageAnnotatorStub?: unknown;
};

type ReadyStub = { waitForReady?: (deadline: number, callback: (error?: Error) => void) => void };

export async function warmUpVision(client: WarmableVisionClient, {
  log = (line: string) => console.info(line), warn = (line: string) => console.warn(line), now = () => performance.now(), connectTimeoutMs = 10_000,
}: { log?: (line: string) => void; warn?: (line: string) => void; now?: () => number; connectTimeoutMs?: number } = {}): Promise<boolean> {
  const started = now();
  // 1. The access token first: if Google or the credentials are unavailable, nothing else is set up or cached.
  try {
    await client.auth.getAccessToken();
  } catch {
    warn('Google Vision warm-up skipped: credentials or network unavailable. The first scan will connect instead.');
    return false;
  }
  // 2. The client's service stub. A failed set-up is cleared so the first scan initializes again instead of reusing it.
  let stub: unknown;
  try {
    stub = await client.initialize();
  } catch {
    client.imageAnnotatorStub = undefined;
    warn('Google Vision warm-up could not prepare the client. The first scan will connect instead.');
    return false;
  }
  // 3. Open the connection now (no request is sent). If it cannot connect, the client simply reconnects on the first scan.
  const ready = (stub as ReadyStub | null)?.waitForReady;
  if (typeof ready === 'function') {
    try {
      await new Promise<void>((resolve, reject) => ready.call(stub, Date.now() + connectTimeoutMs, (error) => (error ? reject(error) : resolve())));
    } catch {
      warn('Google Vision warm-up could not connect yet. The first scan will connect instead.');
      return false;
    }
  }
  log(`Google Vision ready (${Math.round(now() - started)} ms)`);
  return true;
}
