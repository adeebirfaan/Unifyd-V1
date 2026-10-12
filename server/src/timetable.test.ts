import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import { createApp } from './app.js';
import type { OcrPage } from './timetable-parser.js';
import { pagesFromAnnotation, readTimetableWithVision, TimetableDocumentError } from './timetable-vision.js';

const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(16)]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const pdf = Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n');
const listPage: OcrPage = { text: 'BCS2233 SOFTWARE REQUIREMENT WORKSHOP MON 10:00-12:00 BZ-01-120', words: [] };

function timetableApp(options: { pages?: OcrPage[]; totalPages?: number; fail?: Error } = {}) {
  const reads: { kind: string; bytes: number }[] = [];
  const app = createApp({
    verifyToken: async (token) => token === 'valid-test-token',
    detectText: async () => '',
    readTimetable: async (file, kind) => {
      reads.push({ kind, bytes: file.length });
      if (options.fail) throw options.fail;
      return { pages: options.pages ?? [listPage], totalPages: options.totalPages ?? 1 };
    },
  });
  return { app, reads };
}

const upload = (app: ReturnType<typeof createApp>, file: Buffer, filename: string, contentType: string, token = 'valid-test-token') =>
  request(app).post('/api/timetable/import').set('Authorization', `Bearer ${token}`).attach('file', file, { filename, contentType });

test('timetable import requires a verified sign-in before reading the file', async () => {
  const { app, reads } = timetableApp();
  await request(app).post('/api/timetable/import').attach('file', png, { filename: 't.png', contentType: 'image/png' }).expect(401);
  await upload(app, png, 't.png', 'image/png', 'wrong').expect(401);
  assert.equal(reads.length, 0);
});

test('a PNG or JPEG returns an editable draft only, with review required', async () => {
  const { app, reads } = timetableApp();
  const response = await upload(app, png, 'timetable.png', 'image/png').expect(200);
  assert.deepEqual(Object.keys(response.body).sort(), ['candidates', 'pagesProcessed', 'totalPages', 'warnings']);
  assert.equal(response.body.candidates[0].courseCode, 'BCS2233');
  assert.ok(response.body.warnings.includes('REVIEW_REQUIRED'));
  assert.ok(!('rawText' in response.body));
  await upload(app, jpeg, 'timetable.jpg', 'image/jpeg').expect(200);
  assert.deepEqual(reads.map((read) => read.kind), ['image', 'image']);
});

test('PDFs are read as documents, limited to the first three pages', async () => {
  const pages = Array.from({ length: 5 }, (_, index) => ({ text: `BCS22${30 + index} MON ${10 + index}:00-${11 + index}:00`, words: [] }));
  const { app, reads } = timetableApp({ pages, totalPages: 5 });
  const response = await upload(app, pdf, 'timetable.pdf', 'application/pdf').expect(200);
  assert.equal(reads[0]!.kind, 'pdf');
  assert.equal(response.body.pagesProcessed, 3);
  assert.equal(response.body.totalPages, 5);
  assert.ok(response.body.warnings.includes('PAGES_TRUNCATED'));
  assert.equal(response.body.candidates.length, 3);
});

test('unsupported, mislabelled, oversized, protected, and corrupted files fail safely', async () => {
  const { app, reads } = timetableApp();
  assert.equal((await upload(app, Buffer.from('hello'), 'notes.txt', 'text/plain').expect(415)).body.error.code, 'UNSUPPORTED_FILE');
  assert.equal((await upload(app, Buffer.from('not really a png'), 'fake.png', 'image/png').expect(415)).body.error.code, 'UNSUPPORTED_FILE');
  assert.equal((await upload(app, png, 'pdf-named.pdf', 'application/pdf').expect(415)).body.error.code, 'UNSUPPORTED_FILE');
  const big = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]);
  assert.equal((await upload(app, big, 'big.png', 'image/png').expect(413)).body.error.code, 'FILE_TOO_LARGE');
  const locked = Buffer.from('%PDF-1.7\n trailer << /Encrypt 5 0 R >>\n%%EOF');
  assert.equal((await upload(app, locked, 'locked.pdf', 'application/pdf').expect(422)).body.error.code, 'PDF_PROTECTED');
  const truncated = Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog');
  assert.equal((await upload(app, truncated, 'cut.pdf', 'application/pdf').expect(422)).body.error.code, 'INVALID_DOCUMENT');
  assert.equal(reads.length, 0, 'invalid files never reach OCR');
});

test('unreadable documents and provider failures return safe errors without details', async () => {
  const unreadable = await upload(timetableApp({ fail: new TimetableDocumentError() }).app, pdf, 't.pdf', 'application/pdf').expect(422);
  assert.equal(unreadable.body.error.code, 'INVALID_DOCUMENT');
  const failed = await upload(timetableApp({ fail: new Error('secret provider detail BCS2233') }).app, png, 't.png', 'image/png').expect(502);
  assert.equal(failed.body.error.code, 'OCR_UNAVAILABLE');
  assert.ok(!JSON.stringify(failed.body).includes('secret provider detail'));
});

test('Vision annotations become page text and positioned words grouped by block', () => {
  const word = (text: string, x: number) => ({ symbols: [...text].map((char) => ({ text: char })), boundingBox: { vertices: [{ x, y: 10 }, { x: x + 40, y: 10 }, { x: x + 40, y: 20 }, { x, y: 20 }] } });
  const pages = pagesFromAnnotation({ text: 'MON BCS2233', pages: [{ blocks: [{ paragraphs: [{ words: [word('MON', 0)] }] }, { paragraphs: [{ words: [word('BCS2233', 100)] }] }] }] });
  assert.deepEqual(pages, [{ text: 'MON BCS2233', words: [
    { text: 'MON', x0: 0, y0: 10, x1: 40, y1: 20, block: 1 },
    { text: 'BCS2233', x0: 100, y0: 10, x1: 140, y1: 20, block: 2 },
  ] }]);
});

test('PDFs go to Vision inline; an unreadable PDF becomes a document error', async () => {
  const requests: unknown[] = [];
  const client = {
    documentTextDetection: async () => [{}] as never,
    batchAnnotateFiles: async (body: unknown) => {
      requests.push(body);
      return [{ responses: [{ totalPages: 4, responses: [{ fullTextAnnotation: { text: 'BCS2233 MON 10:00-11:00', pages: [{ blocks: [] }] } }] }] }] as never;
    },
  };
  const result = await readTimetableWithVision(client, pdf, 'pdf');
  assert.equal(result.totalPages, 4);
  assert.equal(result.pages[0]!.text, 'BCS2233 MON 10:00-11:00');
  const sent = JSON.stringify(requests[0]);
  assert.ok(sent.includes('application/pdf') && !sent.includes('gcsSource'), 'sent inline, not via storage');

  const broken = { ...client, batchAnnotateFiles: async () => [{ responses: [{ error: { code: 3 } }] }] as never };
  await assert.rejects(readTimetableWithVision(broken, pdf, 'pdf'), TimetableDocumentError);
});
