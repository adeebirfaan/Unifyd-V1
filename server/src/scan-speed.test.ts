import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import { createApp } from './app.js';
import { warmUpVision } from './vision-warmup.js';
import type { WarmableVisionClient } from './vision-warmup.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const text = 'Kedai Buku UMPSA\nDate: 08/10/2026\nTOTAL RM 12.50';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const scan = (app: ReturnType<typeof createApp>, token = 'Bearer some-token') => request(app).post('/api/ocr/receipt').set('Authorization', token)
  .attach('image', jpeg, { filename: 'receipt.jpg', contentType: 'image/jpeg' });

test('a token rejected after the upload has arrived never reaches OCR', async () => {
  const events: string[] = [];
  const app = createApp({
    verifyToken: async () => { await delay(60); events.push('verified:false'); return false; },
    detectText: async () => { events.push('ocr'); return text; },
  });
  await scan(app).expect(401);
  assert.deepEqual(events, ['verified:false']);
});

test('a sign-in check that fails returns 503 and never reaches OCR', async () => {
  let ocr = 0;
  const app = createApp({ verifyToken: async () => { await delay(30); throw new Error('Supabase unreachable'); }, detectText: async () => { ocr += 1; return text; } });
  const response = await scan(app).expect(503);
  assert.equal(response.body.error.code, 'AUTH_UNAVAILABLE');
  assert.equal(ocr, 0);
});

test('OCR starts only after a slow sign-in check has passed, and every request is verified again', async () => {
  const events: string[] = [];
  let checks = 0;
  const app = createApp({
    verifyToken: async () => { checks += 1; await delay(80); events.push('verified'); return true; },
    detectText: async () => { events.push('ocr'); return text; },
  });
  const response = await scan(app).expect(200);
  assert.equal(response.body.totalAmount, 12.5);
  assert.deepEqual(events, ['verified', 'ocr']);
  // No caching: the same token is checked again on the next request.
  await scan(app).expect(200);
  assert.equal(checks, 2);
});

test('upload errors wait for the sign-in check, so an unverified caller only ever sees 401', async () => {
  let ocr = 0;
  const denied = createApp({ verifyToken: async () => { await delay(40); return false; }, detectText: async () => { ocr += 1; return text; } });
  // Not multipart, and a wrong field: both would be 415/400 for a signed-in caller.
  await request(denied).post('/api/ocr/receipt').set('Authorization', 'Bearer x').send({ image: 'x' }).expect(401);
  await request(denied).post('/api/ocr/receipt').set('Authorization', 'Bearer x').attach('wrong', jpeg, { filename: 'receipt.jpg', contentType: 'image/jpeg' }).expect(401);
  assert.equal(ocr, 0);
  const allowed = createApp({ verifyToken: async () => true, detectText: async () => text });
  await request(allowed).post('/api/ocr/receipt').set('Authorization', 'Bearer x').send({ image: 'x' }).expect(415);
});

function fakeClient(overrides: Partial<{ token: () => Promise<unknown>; initialize: () => Promise<unknown> }> = {}) {
  const calls: string[] = [];
  const client: WarmableVisionClient = {
    auth: { getAccessToken: async () => { calls.push('token'); return (overrides.token ?? (async () => 'token'))(); } },
    initialize: async () => { calls.push('initialize'); return (overrides.initialize ?? (async () => ({})))(); },
  };
  return { client, calls };
}

test('warm-up fetches the token, prepares the client, and opens the connection without a Vision request', async () => {
  const logs: string[] = [];
  let connected = false;
  const { client, calls } = fakeClient({ initialize: async () => ({ waitForReady: (_deadline: number, callback: (error?: Error) => void) => { connected = true; callback(); } }) });
  assert.equal(await warmUpVision(client, { log: (line) => logs.push(line), warn: (line) => logs.push(line) }), true);
  assert.deepEqual(calls, ['token', 'initialize']);
  assert.equal(connected, true);
  assert.match(logs[0]!, /^Google Vision ready \(\d+ ms\)$/);
});

test('when Google is unreachable, warm-up logs one line, never throws, and leaves the client fresh for the first scan', async () => {
  const warnings: string[] = [];
  const options = { log: () => undefined, warn: (line: string) => warnings.push(line) };

  // No credentials or network: nothing is set up, so the first scan starts from scratch.
  const offline = fakeClient({ token: async () => { throw new Error('getaddrinfo ENOTFOUND oauth2.googleapis.com secret-detail'); } });
  assert.equal(await warmUpVision(offline.client, options), false);
  assert.deepEqual(offline.calls, ['token']);

  // A failed client set-up is cleared, so the next call initializes again instead of reusing the failure.
  const broken = fakeClient({ initialize: async () => { throw new Error('stub failed'); } });
  broken.client.imageAnnotatorStub = Promise.reject(new Error('cached failure')).catch(() => undefined);
  assert.equal(await warmUpVision(broken.client, options), false);
  assert.equal(broken.client.imageAnnotatorStub, undefined);

  // The connection cannot open yet: reported, not thrown; the client reconnects on the first scan.
  const unreachable = fakeClient({ initialize: async () => ({ waitForReady: (_deadline: number, callback: (error?: Error) => void) => callback(new Error('deadline')) }) });
  assert.equal(await warmUpVision(unreachable.client, options), false);

  assert.equal(warnings.length, 3);
  // Logs carry no provider details.
  for (const line of warnings) assert.doesNotMatch(line, /ENOTFOUND|secret-detail|stub failed|deadline/);
});
