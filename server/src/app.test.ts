import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import { createApp } from './app.js';
import { parseReceiptText } from './receipt-parser.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const sample = 'Kedai Buku UMPSA\nDate: 08/10/2026\nSubtotal RM 11.50\nTOTAL RM 12.50\nChange RM 0.00';
let verified = 0;
let detected = 0;
const app = createApp({
  verifyToken: async (token) => { verified++; return token === 'valid-test-token'; },
  detectText: async () => { detected++; return sample; },
});

test('health is non-sensitive', async () => {
  const response = await request(app).get('/health').expect(200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('Expo Web preflight is scoped to an allowed origin', async () => {
  const allowed = await request(app).options('/api/ocr/receipt').set('Origin', 'http://localhost:8081')
    .set('Access-Control-Request-Method', 'POST').expect(204);
  assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:8081');
  await request(app).options('/api/ocr/receipt').set('Origin', 'https://untrusted.example')
    .set('Access-Control-Request-Method', 'POST').expect(403);
});

test('authentication is required before parsing or OCR', async () => {
  const before = detected;
  await request(app).post('/api/ocr/receipt').attach('image', jpeg, { filename: 'receipt.jpg', contentType: 'image/jpeg' }).expect(401);
  await request(app).post('/api/ocr/receipt').set('Authorization', 'Bearer wrong')
    .attach('image', jpeg, { filename: 'receipt.jpg', contentType: 'image/jpeg' }).expect(401);
  assert.equal(detected, before);
  assert.ok(verified > 0);
});

test('one authenticated receipt returns only reviewable fields', async () => {
  const response = await request(app).post('/api/ocr/receipt').set('Authorization', 'Bearer valid-test-token')
    .attach('image', jpeg, { filename: 'receipt.jpg', contentType: 'image/jpeg' }).expect(200);
  assert.deepEqual(response.body, {
    merchantName: 'Kedai Buku UMPSA', purchaseDate: '2026-10-08', totalAmount: 12.5,
    rawText: sample, warnings: [],
  });
});

test('missing, multiple, wrong-field, invalid-type and oversized uploads fail safely', async () => {
  const route = () => request(app).post('/api/ocr/receipt').set('Authorization', 'Bearer valid-test-token');
  await route().field('note', 'unexpected').expect(400);
  await route().attach('other', jpeg, { filename: 'receipt.jpg', contentType: 'image/jpeg' }).expect(400);
  await route().attach('image', jpeg, { filename: 'receipt.jpg', contentType: 'image/jpeg' })
    .attach('image', jpeg, { filename: 'second.jpg', contentType: 'image/jpeg' }).expect(400);
  await route().attach('image', Buffer.from('not an image'), { filename: 'receipt.jpg', contentType: 'image/jpeg' }).expect(415);
  await route().attach('image', jpeg, { filename: 'receipt.gif', contentType: 'image/gif' }).expect(415);
  await route().attach('image', Buffer.concat([jpeg, Buffer.alloc(5 * 1024 * 1024)]), { filename: 'receipt.jpg', contentType: 'image/jpeg' }).expect(413);
});

test('parser leaves uncertain values empty with review warnings', () => {
  assert.deepEqual(parseReceiptText('Unreadable'), {
    merchantName: 'Unreadable', purchaseDate: null, totalAmount: null, rawText: 'Unreadable',
    warnings: ['Purchase date needs review.', 'Total amount needs review.'],
  });
  assert.equal(parseReceiptText('Shop\n31/02/2026\nTOTAL RM 7.00').purchaseDate, null);
});

test('parser reads a rounded total printed below its label', () => {
  const text = [
    'PUSTAKA RAKYAT (BANGI) SDN BHD', 'Sub Total:', '89.70', 'Service Charge:', '0.00',
    'Rounding Adjustment:', '0.00', 'Rounded Total (RM):', '89.70', 'Custom pay', '89.70',
  ].join('\n');
  const result = parseReceiptText(text);
  assert.equal(result.totalAmount, 89.70);
  assert.ok(!result.warnings.includes('Total amount needs review.'));
  assert.equal(parseReceiptText('Shop\nSub Total:\n89.70\nService Charge:\n0.00').totalAmount, null);
});

test('parser reviews an integer handwritten total and joins a split merchant name', () => {
  const text = [
    'M/S', 'ZAHIRA', 'BT. ALI', 'Date:', 'No 20792', 'Jus GAMAT', 'KRIM VIT C',
    '50%=', '50%=', '8209)', 'TOTAL / WT 88', 'JUMLAH', 'Signature/Tandatangan/ T',
  ].join('\n');
  const result = parseReceiptText(text);
  assert.equal(result.merchantName, 'M/S ZAHIRA BT. ALI');
  assert.equal(result.purchaseDate, null);
  assert.equal(result.totalAmount, 88);
  assert.deepEqual(result.warnings, ['Purchase date needs review.', 'Total amount needs review.']);
  assert.equal(parseReceiptText('Shop\nTOTAL / WT\n88/=').totalAmount, 88);
  assert.equal(parseReceiptText('Shop\nNo 20792\nAMOUNT 88 items').totalAmount, null);
});

test('provider failure does not expose the underlying exception', async () => {
  const failing = createApp({ verifyToken: async () => true, detectText: async () => { throw new Error('private provider detail'); } });
  const response = await request(failing).post('/api/ocr/receipt').set('Authorization', 'Bearer valid-test-token')
    .attach('image', jpeg, { filename: 'receipt.jpg', contentType: 'image/jpeg' }).expect(502);
  assert.equal(response.body.error.code, 'OCR_UNAVAILABLE');
  assert.ok(!JSON.stringify(response.body).includes('private provider detail'));
});
