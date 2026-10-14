import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeReceiptImage } from '../lib/receiptImage.ts';
import { formatScanTiming } from '../lib/scanTiming.ts';

test('the scan timing line has the stages, the image size, and the outcome only', () => {
  const line = formatScanTiming({
    prepare: { totalMs: 640.4, decodeMs: 210.2, encodeMs: [430.1], width: 1800, height: 2400, bytes: 1268000 },
    upload: { sessionMs: 3.6, requestMs: 2350.4 }, minWaitMs: 0, totalMs: 3010.2, outcome: 'ok',
  });
  assert.equal(line, '[scan-timing] prepare=640ms (decode=210ms encode=430ms ×1) image=1800×2400 1.21MB | session=4ms upload+server=2350ms | minWait=0ms | total=3010ms | ok');
  // A retry reuses the prepared photo, so there is no prepare stage; a fast reply shows the 1.2 s minimum wait.
  assert.equal(formatScanTiming({ upload: { sessionMs: 2, requestMs: 400 }, minWaitMs: 798, totalMs: 1200, outcome: 'error:network' }),
    '[scan-timing] session=2ms upload+server=400ms | minWait=798ms | total=1200ms | error:network');
});

test('photo preparation reports decode and each encode, including the one size retry', async () => {
  let clock = 0;
  const now = () => clock;
  const tools = {
    decode: async () => { clock += 200; return { width: 3024, height: 4032 }; },
    encode: async (_image, size, quality) => { clock += 300; return { uri: 'file:///x.jpg', ...size, size: quality > 0.7 ? 6 * 1024 * 1024 : 2 * 1024 * 1024 }; },
  };
  const timings = [];
  const image = await normalizeReceiptImage('photo', tools, (timing) => timings.push(timing), now);
  assert.equal(image.mimeType, 'image/jpeg');
  assert.deepEqual(timings, [{ decodeMs: 200, encodeMs: [300, 300], width: 1800, height: 2400, bytes: 2 * 1024 * 1024 }]);
  // Without a callback nothing changes.
  clock = 0;
  assert.deepEqual(await normalizeReceiptImage('photo', tools), image);
});
