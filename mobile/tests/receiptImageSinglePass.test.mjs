import assert from 'node:assert/strict';
import test from 'node:test';

import { RECEIPT_JPEG_QUALITY, RECEIPT_MAX_BYTES, RECEIPT_RETRY_QUALITY, ReceiptImageError, normalizeReceiptImage } from '../lib/receiptImage.ts';

/**
 * Fake manipulator for one photo with an upright size `actual`. `encode` resizes a decoded image; `encodeFile` does
 * the same straight from the file. JPEG size grows with pixels and quality, as a real encoder's does.
 */
function tools(actual, { bytesPerPixel = 0.5, singlePass = true, fileFails = false } = {}) {
  const calls = [];
  const out = (size, quality, kind) => {
    calls.push({ kind, quality });
    const width = size?.width ?? actual.width;
    const height = size?.height ?? actual.height;
    return { uri: `file:///${kind}.jpg`, width, height, size: Math.round(width * height * bytesPerPixel * quality) };
  };
  return {
    calls,
    tools: {
      decode: async () => { calls.push({ kind: 'decode' }); return { ...actual }; },
      encode: async (_image, size, quality) => out(size, quality, 'encode'),
      ...(singlePass ? { encodeFile: async (_uri, size, quality) => { if (fileFails) throw new Error('cannot read file'); return out(size, quality, 'file'); } } : {}),
      release: () => undefined,
    },
  };
}
const shape = (image) => ({ width: image.width, height: image.height, size: image.size, mimeType: image.mimeType, fileName: image.fileName });

test('the single pass produces exactly the same output size and quality as decode-then-encode, without a separate decode', async () => {
  for (const photo of [{ width: 3024, height: 4032 }, { width: 4032, height: 3024 }, { width: 8064, height: 6048 }, { width: 1170, height: 2532 }, { width: 900, height: 1200 }, { width: 1800, height: 2400 }]) {
    const twoPass = tools(photo, { singlePass: false });
    const onePass = tools(photo);
    const before = await normalizeReceiptImage('photo', twoPass.tools, { size: photo });
    const after = await normalizeReceiptImage('photo', onePass.tools, { size: photo });
    assert.deepEqual(shape(after), shape(before), `${photo.width}×${photo.height}`);
    assert.deepEqual(onePass.calls, [{ kind: 'file', quality: RECEIPT_JPEG_QUALITY }], `${photo.width}×${photo.height}`);
    assert.deepEqual(twoPass.calls.map((call) => call.kind), ['decode', 'encode']);
  }
});

test('the single pass keeps the one stronger compression when the first JPEG is over 5 MB', async () => {
  const photo = { width: 1800, height: 2400 };
  const onePass = tools(photo, { bytesPerPixel: 2 });
  const image = await normalizeReceiptImage('photo', onePass.tools, { size: photo });
  assert.deepEqual(onePass.calls.map((call) => call.quality), [RECEIPT_JPEG_QUALITY, RECEIPT_RETRY_QUALITY]);
  assert.ok(image.size <= RECEIPT_MAX_BYTES);
  const tooBig = tools(photo, { bytesPerPixel: 10 * 1024 * 1024 / (1800 * 2400) });
  await assert.rejects(normalizeReceiptImage('photo', tooBig.tools, { size: photo }), (error) => error instanceof ReceiptImageError && error.code === 'tooLarge');
});

test('without the photo size, or when the single pass fails or differs, the two-pass path runs as before', async () => {
  const photo = { width: 3024, height: 4032 };
  const expected = shape(await normalizeReceiptImage('photo', tools(photo, { singlePass: false }).tools));

  const noSize = tools(photo);
  assert.deepEqual(shape(await normalizeReceiptImage('photo', noSize.tools)), expected);
  assert.deepEqual(noSize.calls.map((call) => call.kind), ['decode', 'encode']);

  const zeroSize = tools(photo);
  assert.deepEqual(shape(await normalizeReceiptImage('photo', zeroSize.tools, { size: { width: 0, height: 0 } })), expected);
  assert.deepEqual(zeroSize.calls.map((call) => call.kind), ['decode', 'encode']);

  const fails = tools(photo, { fileFails: true });
  assert.deepEqual(shape(await normalizeReceiptImage('photo', fails.tools, { size: photo })), expected);
  assert.deepEqual(fails.calls.map((call) => call.kind), ['decode', 'encode']);

  // A small photo whose reported size is wrong (sideways): the unresized single pass does not match, so it is redone.
  const small = { width: 1200, height: 900 };
  const sideways = tools(small);
  const image = await normalizeReceiptImage('photo', sideways.tools, { size: { width: 900, height: 1200 } });
  assert.deepEqual([image.width, image.height], [1200, 900]);
  assert.deepEqual(sideways.calls.map((call) => call.kind), ['file', 'decode', 'encode']);
});

test('scan timing marks a single pass', async () => {
  const photo = { width: 3024, height: 4032 };
  let clock = 0;
  const timings = [];
  const fake = tools(photo);
  fake.tools.encodeFile = async (_uri, size, quality) => { clock += 180; return { uri: 'file:///f.jpg', ...size, size: Math.round(size.width * size.height * 0.5 * quality) }; };
  await normalizeReceiptImage('photo', fake.tools, { size: photo, onTiming: (timing) => timings.push(timing), now: () => clock });
  assert.deepEqual(timings, [{ decodeMs: 0, encodeMs: [180], width: 1800, height: 2400, bytes: Math.round(1800 * 2400 * 0.5 * RECEIPT_JPEG_QUALITY), singlePass: true }]);
});
