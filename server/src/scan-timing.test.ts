import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import { createApp } from './app.js';
import { createScanTiming, formatScanTiming } from './scan-timing.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const text = 'Kedai Buku UMPSA\nDate: 08/10/2026\nNotebook 12.50\nTOTAL RM 12.50';

test('the timing line lists stages, status, size, and whether it is the first scan', () => {
  assert.equal(formatScanTiming({ scan: 1, status: 200, bytes: 812345, stages: { auth: 118.4, upload: 41, vision: 1830.2, parse: 3.6, items: 1.2 }, total: 2001 }),
    '[scan-timing] scan=1 first=yes status=200 bytes=812345 auth=118ms upload=41ms vision=1830ms parse=4ms items=1ms total=2001ms');
  assert.equal(formatScanTiming({ scan: 2, status: 401, bytes: null, stages: {}, total: 3 }), '[scan-timing] scan=2 first=no status=401 total=3ms');
});

test('timing is off by default and logs nothing', async () => {
  const lines: string[] = [];
  const timer = createScanTiming({ enabled: false, log: (line) => lines.push(line) })();
  timer.stage('auth'); timer.bytes(10); timer.end(200);
  assert.deepEqual(lines, []);
  // The app's default timer is the disabled one.
  const app = createApp({ verifyToken: async () => true, detectText: async () => text });
  await request(app).post('/api/ocr/receipt').set('Authorization', 'Bearer valid-test-token').attach('image', jpeg, { filename: 'receipt.jpg', contentType: 'image/jpeg' }).expect(200);
});

test('a timed scan logs one line of durations only, and the response is unchanged', async () => {
  const lines: string[] = [];
  let clock = 0;
  const scanTimer = createScanTiming({ enabled: true, log: (line) => lines.push(line), now: () => (clock += 5) });
  const timed = createApp({ verifyToken: async () => true, detectText: async () => text, scanTimer });
  const plain = createApp({ verifyToken: async () => true, detectText: async () => text });
  const send = (app: typeof timed) => request(app).post('/api/ocr/receipt').set('Authorization', 'Bearer secret-token-value')
    .attach('image', jpeg, { filename: 'receipt.jpg', contentType: 'image/jpeg' }).expect(200);
  const [withTiming, without] = [await send(timed), await send(plain)];
  assert.deepEqual(withTiming.body, without.body);
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /^\[scan-timing\] scan=1 first=yes status=200 bytes=12 upload=\d+ms authCheck=\d+ms authWait=\d+ms vision=\d+ms parse=\d+ms items=\d+ms total=\d+ms$/);
  // Never content, tokens, or user data.
  assert.doesNotMatch(lines[0]!, /Kedai|UMPSA|Notebook|12\.50|secret-token-value|Bearer/);

  // Errors are timed too, with their status and only the stages reached.
  const denied = createApp({ verifyToken: async () => false, detectText: async () => text, scanTimer });
  await request(denied).post('/api/ocr/receipt').set('Authorization', 'Bearer x').attach('image', jpeg, { filename: 'receipt.jpg', contentType: 'image/jpeg' }).expect(401);
  assert.match(lines[1]!, /^\[scan-timing\] scan=2 first=no status=401 upload=\d+ms authCheck=\d+ms total=\d+ms$/);
});
