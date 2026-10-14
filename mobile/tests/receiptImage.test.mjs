import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RECEIPT_JPEG_QUALITY, RECEIPT_MAX_BYTES, RECEIPT_MAX_EDGE, RECEIPT_MIN_EDGE, RECEIPT_RETRY_QUALITY,
  ReceiptImageError, normalizeReceiptImage, receiptTargetSize,
} from '../lib/receiptImage.ts';

const MB = 1024 * 1024;

/**
 * Fake manipulator: `photos` maps a URI to its upright pixel size and source format. The JPEG size grows with
 * pixels and quality (`bytesPerPixel` at quality 1), roughly as a real encoder does.
 */
function fakeTools(photos, { bytesPerPixel = 0.5, failDecode = false, failEncode = false } = {}) {
  const calls = { encode: [], released: [] };
  return {
    calls,
    tools: {
      async decode(uri) {
        if (failDecode || !photos[uri]) throw new Error('cannot decode');
        return { uri, ...photos[uri] };
      },
      async encode(image, size, quality) {
        calls.encode.push({ size, quality });
        if (failEncode) throw new Error('cannot encode');
        const width = size?.width ?? image.width;
        const height = size?.height ?? image.height;
        return { uri: `file:///cache/${calls.encode.length}.jpg`, width, height, size: Math.round(width * height * bytesPerPixel * quality) };
      },
      release: (image) => calls.released.push(image.uri),
    },
  };
}

test('a HEIC photo from an iPhone becomes a JPEG upload named receipt.jpg', async () => {
  const { tools, calls } = fakeTools({ 'file:///IMG_0001.HEIC': { width: 3024, height: 4032, format: 'heic' } });
  const image = await normalizeReceiptImage('file:///IMG_0001.HEIC', tools);
  assert.equal(image.mimeType, 'image/jpeg');
  assert.equal(image.fileName, 'receipt.jpg');
  assert.match(image.uri, /\.jpg$/);
  assert.equal(calls.encode[0].quality, RECEIPT_JPEG_QUALITY);
  assert.deepEqual(calls.released, ['file:///IMG_0001.HEIC']);
});

test('large photos shrink to a 2400 px longest side, keeping the aspect ratio', async () => {
  const { tools } = fakeTools({ portrait: { width: 3024, height: 4032 }, landscape: { width: 8064, height: 6048 } });
  const portrait = await normalizeReceiptImage('portrait', tools);
  assert.deepEqual([portrait.width, portrait.height], [1800, 2400]);
  const landscape = await normalizeReceiptImage('landscape', tools);
  assert.deepEqual([landscape.width, landscape.height], [2400, 1800]);
  assert.deepEqual(receiptTargetSize(1000, 5000), { width: 480, height: 2400 });
});

test('small photos are never upscaled', async () => {
  const { tools, calls } = fakeTools({ small: { width: 900, height: 1200 }, edge: { width: 1800, height: RECEIPT_MAX_EDGE } });
  const small = await normalizeReceiptImage('small', tools);
  assert.deepEqual([small.width, small.height], [900, 1200]);
  assert.equal(calls.encode[0].size, null);
  assert.equal(receiptTargetSize(1800, RECEIPT_MAX_EDGE), null);
  // Still re-encoded, so a small PNG or HEIC still uploads as a JPEG.
  assert.equal((await normalizeReceiptImage('edge', tools)).mimeType, 'image/jpeg');
});

test('a resized photo never drops below the OCR minimum', () => {
  for (const [width, height] of [[4032, 3024], [12000, 9000], [2401, 100]]) {
    const size = receiptTargetSize(width, height);
    assert.ok(Math.max(size.width, size.height) >= RECEIPT_MIN_EDGE, `${width}x${height}`);
  }
  assert.equal(Math.max(...Object.values(receiptTargetSize(4032, 3024, 1000))), RECEIPT_MIN_EDGE);
});

test('the result is under 5 MB, with one stronger compression when the first JPEG is too big', async () => {
  const typical = fakeTools({ photo: { width: 6048, height: 8064 } });
  const image = await normalizeReceiptImage('photo', typical.tools);
  assert.ok(image.size <= RECEIPT_MAX_BYTES);
  assert.equal(typical.calls.encode.length, 1);

  // A dense image: about 6.9 MB at 0.8 is retried once at 0.6 (about 4.9 MiB), at the same size.
  const dense = fakeTools({ photo: { width: 1800, height: 2400 } }, { bytesPerPixel: 2 });
  const retried = await normalizeReceiptImage('photo', dense.tools);
  assert.deepEqual(dense.calls.encode.map((call) => call.quality), [RECEIPT_JPEG_QUALITY, RECEIPT_RETRY_QUALITY]);
  assert.deepEqual(dense.calls.encode[0].size, dense.calls.encode[1].size);
  assert.ok(retried.size <= RECEIPT_MAX_BYTES);
});

test('a photo still over 5 MB after the retry reports tooLarge', async () => {
  const { tools, calls } = fakeTools({ photo: { width: 1800, height: 2400 } }, { bytesPerPixel: 10 * MB / (1800 * 2400) });
  await assert.rejects(normalizeReceiptImage('photo', tools), (error) => error instanceof ReceiptImageError && error.code === 'tooLarge');
  assert.equal(calls.encode.length, 2);
  assert.deepEqual(calls.released, ['photo']);
});

test('a photo that cannot be decoded or converted reports conversionFailed', async () => {
  const isConversion = (error) => error instanceof ReceiptImageError && error.code === 'conversionFailed';
  await assert.rejects(normalizeReceiptImage('missing', fakeTools({}).tools), isConversion);
  await assert.rejects(normalizeReceiptImage('photo', fakeTools({ photo: { width: 10, height: 10 } }, { failDecode: true }).tools), isConversion);
  const encodeFails = fakeTools({ photo: { width: 3024, height: 4032 } }, { failEncode: true });
  await assert.rejects(normalizeReceiptImage('photo', encodeFails.tools), isConversion);
  assert.deepEqual(encodeFails.calls.released, ['photo']);
  await assert.rejects(normalizeReceiptImage('empty', fakeTools({ empty: { width: 0, height: 0 } }).tools), isConversion);
});
