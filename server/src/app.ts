import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';

import { parseReceiptText } from './receipt-parser.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type OcrDependencies = {
  verifyToken: (token: string) => Promise<boolean>;
  detectText: (image: Buffer) => Promise<string>;
};

function actualMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function errorResponse(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

export function createApp({ verifyToken, detectText }: OcrDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api/ocr/receipt', (request, response, next) => {
    const origin = request.header('origin');
    const configured = (process.env.OCR_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    const allowed = Boolean(origin && (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || configured.includes(origin)));
    if (origin) response.vary('Origin');
    if (allowed) {
      response.setHeader('Access-Control-Allow-Origin', origin!);
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
    if (request.method === 'OPTIONS') return response.sendStatus(allowed ? 204 : 403);
    next();
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 1, fieldNameSize: 32 },
    fileFilter: (_request, file, callback) => {
      if (!MIME_TYPES.has(file.mimetype)) return callback(new Error('UNSUPPORTED_IMAGE'));
      callback(null, true);
    },
  }).single('image');

  app.get('/health', (_request, response) => response.json({ status: 'ok' }));

  app.post('/api/ocr/receipt', async (request: Request, response: Response) => {
    const authorization = request.header('authorization') ?? '';
    const token = /^Bearer ([^\s]+)$/.exec(authorization)?.[1];
    if (!token) return errorResponse(response, 401, 'UNAUTHORIZED', 'A valid sign-in is required.');
    try {
      if (!(await verifyToken(token))) return errorResponse(response, 401, 'UNAUTHORIZED', 'A valid sign-in is required.');
    } catch {
      return errorResponse(response, 503, 'AUTH_UNAVAILABLE', 'Sign-in verification is unavailable. Please retry.');
    }
    if (!request.is('multipart/form-data')) return errorResponse(response, 415, 'INVALID_UPLOAD', 'Send one receipt image as multipart form data.');

    upload(request, response, async (uploadError?: unknown) => {
      if (uploadError) {
        if (uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE') {
          return errorResponse(response, 413, 'IMAGE_TOO_LARGE', 'The image must be 5 MB or smaller.');
        }
        if (uploadError instanceof Error && uploadError.message === 'UNSUPPORTED_IMAGE') {
          return errorResponse(response, 415, 'UNSUPPORTED_IMAGE', 'Use a JPEG, PNG, or WEBP image.');
        }
        return errorResponse(response, 400, 'INVALID_UPLOAD', 'Send exactly one image in the image field.');
      }
      const image = request.file;
      if (!image || image.size === 0) return errorResponse(response, 400, 'MISSING_IMAGE', 'Choose a receipt image.');
      if (actualMime(image.buffer) !== image.mimetype) {
        return errorResponse(response, 415, 'UNSUPPORTED_IMAGE', 'Use a valid JPEG, PNG, or WEBP image.');
      }
      try {
        const text = await detectText(image.buffer);
        response.json(parseReceiptText(text));
      } catch {
        // Provider details, image content and access tokens must not reach clients or logs.
        errorResponse(response, 502, 'OCR_UNAVAILABLE', 'The receipt could not be read. Please retry or enter it manually.');
      }
    });
  });

  return app;
}
