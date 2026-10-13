import { createHash } from 'node:crypto';
import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';

import { MAX_TITLE_LENGTH, suggestCategory } from './expense-classifier.js';
import type { LabelledExpense } from './expense-classifier.js';
import { DEFAULT_TIME_ZONE, isValidTimeZone } from './insight-facts.js';
import type { InsightFacts } from './insight-facts.js';
import { GroqError, groqMessages, groqPayload, validateSummary } from './insight-summary.js';
import type { GroqMessage, InsightSummary, SummaryLanguage } from './insight-summary.js';
import { isCrisisMessage, parsePoofRequest, poofMessages, validatePoofReply } from './poof-chat.js';
import { parseReceiptText } from './receipt-parser.js';
import { parseTimetable } from './timetable-parser.js';
import type { OcrPage } from './timetable-parser.js';
import { TimetableDocumentError } from './timetable-vision.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Timetables: PNG, JPEG, or PDF, with the same 5 MiB limit as receipts. Only the first
// three PDF pages are parsed. Uploads stay in memory and are never stored.
const TIMETABLE_MAX_BYTES = 5 * 1024 * 1024;
const TIMETABLE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
export const TIMETABLE_MAX_PDF_PAGES = 3;

export type OcrDependencies = {
  verifyToken: (token: string) => Promise<boolean>;
  /** Vision text, optionally with the word boxes from the same call (used to pair receipt labels with amounts). */
  detectText: (image: Buffer) => Promise<string | { text: string; pages?: OcrPage[] }>;
  insights?: InsightDependencies;
  poof?: PoofDependencies;
  categories?: CategoryDependencies;
  /** Reads a timetable image or PDF in memory; throws TimetableDocumentError for unreadable PDFs. */
  readTimetable?: (file: Buffer, kind: 'image' | 'pdf') => Promise<{ pages: OcrPage[]; totalPages: number }>;
};

export type InsightDependencies = {
  /** Reads only the caller's rows with their own token, so Supabase RLS still applies. */
  loadFacts: (token: string, timeZone: string, now: Date) => Promise<{ userId: string; facts: InsightFacts }>;
  /** Null when no Groq key is configured; the endpoint then returns facts with a fallback. */
  summarize: ((messages: ReturnType<typeof groqMessages>) => Promise<string>) | null;
  now?: () => Date;
};

export type PoofDependencies = {
  /** Null when no Groq key is configured; the endpoint then returns a fallback and the app answers with its rules. */
  reply: ((messages: GroqMessage[]) => Promise<string>) | null;
  /** Requests allowed per signed-in session within the window; protects the shared AI key. */
  rateLimit?: { max: number; windowMs: number };
  now?: () => number;
};

export type CategoryDependencies = {
  /** Reads only the verified caller's labelled expense titles and categories, with their own token (RLS applies). */
  loadHistory: (token: string) => Promise<{ userId: string; history: LabelledExpense[] }>;
  /** Requests allowed per signed-in session within the window. */
  rateLimit?: { max: number; windowMs: number };
  now?: () => number;
};

type FallbackReason = 'not_configured' | 'unavailable' | 'invalid_response';
type PoofFallbackReason = FallbackReason | 'safety';
const POOF_RATE_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 };
const CATEGORY_RATE_LIMIT = { max: 60, windowMs: 10 * 60 * 1000 };
const SUMMARY_CACHE_MS = 10 * 60 * 1000;

function actualMime(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function errorResponse(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

function bearerToken(request: Request): string | undefined {
  return /^Bearer ([^\s]+)$/.exec(request.header('authorization') ?? '')?.[1];
}

/** Sliding-window limiter keyed by a hash of the session token, so raw tokens are never kept. */
function allowRequest(store: Map<string, number[]>, token: string, now: number, limit: { max: number; windowMs: number }): boolean {
  const key = createHash('sha256').update(token).digest('hex');
  const recent = (store.get(key) ?? []).filter((at) => now - at < limit.windowMs);
  if (recent.length >= limit.max) return false;
  recent.push(now);
  store.set(key, recent);
  if (store.size > 5000) for (const [entry, times] of store) if (!times.some((at) => now - at < limit.windowMs)) store.delete(entry);
  return true;
}

/** Exactly `{ title }`, a non-blank string of at most 120 characters. Any other field (such as a user ID) is refused. */
function parseCategoryRequest(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  const title = (body as { title?: unknown }).title;
  if (keys.length !== 1 || keys[0] !== 'title' || typeof title !== 'string') return null;
  const trimmed = title.trim();
  return trimmed && trimmed.length <= MAX_TITLE_LENGTH ? trimmed : null;
}

export function createApp({ verifyToken, detectText, insights, poof, readTimetable, categories }: OcrDependencies) {
  const app = express();
  app.disable('x-powered-by');
  // Identical facts reuse a recent summary so refreshes do not repeatedly call Groq.
  const summaryCache = new Map<string, { key: string; summary: InsightSummary; at: number }>();
  // Recent Poof request times per session, keyed by a hash so raw tokens are never kept.
  const poofRequests = new Map<string, number[]>();
  const categoryRequests = new Map<string, number[]>();
  app.use(['/api/ocr/receipt', '/api/insights/generate', '/api/timetable/import', '/api/poof/chat', '/api/ml/expense-category-suggestion'], (request, response, next) => {
    const origin = request.header('origin');
    const configured = (process.env.OCR_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    const allowed = Boolean(origin && (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || configured.includes(origin)));
    if (origin) response.vary('Origin');
    if (allowed) {
      response.setHeader('Access-Control-Allow-Origin', origin!);
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.setHeader('Access-Control-Max-Age', '600');
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

  const timetableUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: TIMETABLE_MAX_BYTES, files: 1, fields: 0, parts: 1, fieldNameSize: 32 },
    fileFilter: (_request, file, callback) => {
      if (!TIMETABLE_MIME_TYPES.has(file.mimetype)) return callback(new Error('UNSUPPORTED_FILE'));
      callback(null, true);
    },
  }).single('file');

  app.get('/health', (_request, response) => response.json({ status: 'ok' }));

  app.post('/api/ocr/receipt', async (request: Request, response: Response) => {
    const token = bearerToken(request);
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
        const detected = await detectText(image.buffer);
        const { text, pages } = typeof detected === 'string' ? { text: detected, pages: undefined } : detected;
        response.json(parseReceiptText(text, pages));
      } catch {
        // Provider details, image content and access tokens must not reach clients or logs.
        errorResponse(response, 502, 'OCR_UNAVAILABLE', 'The receipt could not be read. Please retry or enter it manually.');
      }
    });
  });

  app.post('/api/insights/generate', express.json({ limit: '2kb' }), async (request: Request, response: Response) => {
    const token = bearerToken(request);
    if (!token) return errorResponse(response, 401, 'UNAUTHORIZED', 'A valid sign-in is required.');
    try {
      if (!(await verifyToken(token))) return errorResponse(response, 401, 'UNAUTHORIZED', 'A valid sign-in is required.');
    } catch {
      return errorResponse(response, 503, 'AUTH_UNAVAILABLE', 'Sign-in verification is unavailable. Please retry.');
    }
    if (!insights) return errorResponse(response, 503, 'INSIGHTS_UNAVAILABLE', 'Insights are not available right now.');
    const body: Record<string, unknown> = request.body && typeof request.body === 'object' ? request.body : {};
    const language: SummaryLanguage = body.language === 'ms' ? 'ms' : 'en';
    const timeZone = body.timeZone === undefined ? DEFAULT_TIME_ZONE : body.timeZone;
    if (!isValidTimeZone(timeZone)) return errorResponse(response, 400, 'INVALID_REQUEST', 'Send a valid time zone.');

    const now = insights.now?.() ?? new Date();
    let loaded: Awaited<ReturnType<InsightDependencies['loadFacts']>>;
    try {
      loaded = await insights.loadFacts(token, timeZone, now);
    } catch {
      return errorResponse(response, 503, 'FACTS_UNAVAILABLE', 'Your dashboard data could not be loaded. Please retry.');
    }
    const { userId, facts } = loaded;
    const payload = groqPayload(facts);
    const send = (summary: InsightSummary | null, fallbackReason: FallbackReason | null) => response.json({
      facts, summary, source: summary ? 'ai' : 'fallback', fallbackReason, generatedAt: now.toISOString(),
    });

    if (!insights.summarize) return send(null, 'not_configured');
    const cacheKey = `${language}:${JSON.stringify(payload)}`;
    const cached = summaryCache.get(userId);
    if (cached && cached.key === cacheKey && now.getTime() - cached.at < SUMMARY_CACHE_MS) return send(cached.summary, null);

    let raw: string;
    try {
      raw = await insights.summarize(groqMessages(payload, language));
    } catch (error) {
      // Provider errors stay server-side; the student still receives verified facts.
      // Only the status and error code are logged, never facts, summaries, tokens, or keys.
      console.warn(`AI summary unavailable: ${error instanceof GroqError ? `${error.status} ${error.code}` : 'request failed'}`);
      return send(null, 'unavailable');
    }
    const summary = validateSummary(raw, payload, language);
    if (!summary) return send(null, 'invalid_response');
    summaryCache.set(userId, { key: cacheKey, summary, at: now.getTime() });
    return send(summary, null);
  });

  // Poof chat: read-only answers about the caller's own aggregate data. Nothing is
  // stored or logged; questions, facts, and replies stay within this request.
  app.post('/api/poof/chat', express.json({ limit: '8kb' }), async (request: Request, response: Response) => {
    const token = bearerToken(request);
    if (!token) return errorResponse(response, 401, 'UNAUTHORIZED', 'A valid sign-in is required.');
    try {
      if (!(await verifyToken(token))) return errorResponse(response, 401, 'UNAUTHORIZED', 'A valid sign-in is required.');
    } catch {
      return errorResponse(response, 503, 'AUTH_UNAVAILABLE', 'Sign-in verification is unavailable. Please retry.');
    }
    if (!poof) return errorResponse(response, 503, 'POOF_UNAVAILABLE', 'Poof is not available right now.');
    const parsed = parsePoofRequest(request.body);
    if (!parsed) return errorResponse(response, 400, 'INVALID_REQUEST', 'Send a question and a valid data summary.');

    const now = poof.now?.() ?? Date.now();
    const limit = poof.rateLimit ?? POOF_RATE_LIMIT;
    const key = createHash('sha256').update(token).digest('hex');
    const recent = (poofRequests.get(key) ?? []).filter((at) => now - at < limit.windowMs);
    if (recent.length >= limit.max) return errorResponse(response, 429, 'RATE_LIMITED', 'Too many questions. Please wait a moment.');
    recent.push(now);
    poofRequests.set(key, recent);
    if (poofRequests.size > 5000) for (const [entry, times] of poofRequests) if (!times.some((at) => now - at < limit.windowMs)) poofRequests.delete(entry);

    const fallback = (fallbackReason: PoofFallbackReason) => response.json({ source: 'fallback', fallbackReason });
    if (isCrisisMessage(parsed.message)) return fallback('safety');
    if (!poof.reply) return fallback('not_configured');
    let raw: string;
    try {
      raw = await poof.reply(poofMessages(parsed));
    } catch (error) {
      // Only the status and error code are logged, never questions, facts, replies, tokens, or keys.
      console.warn(`Poof reply unavailable: ${error instanceof GroqError ? `${error.status} ${error.code}` : 'request failed'}`);
      return fallback('unavailable');
    }
    const reply = validatePoofReply(raw, parsed.facts, parsed.language);
    if (!reply) return fallback('invalid_response');
    return response.json({ source: 'ai', ...reply });
  });

  // Expense category suggestion: a Multinomial Naive Bayes model trained in memory on the verified
  // caller's own saved titles and categories, for this request only. Nothing is stored, and titles,
  // history, vocabulary, and tokens are never logged. No LLM or remote model is used.
  app.post('/api/ml/expense-category-suggestion', express.json({ limit: '1kb' }), async (request: Request, response: Response) => {
    const token = bearerToken(request);
    if (!token) return errorResponse(response, 401, 'UNAUTHORIZED', 'A valid sign-in is required.');
    try {
      if (!(await verifyToken(token))) return errorResponse(response, 401, 'UNAUTHORIZED', 'A valid sign-in is required.');
    } catch {
      return errorResponse(response, 503, 'AUTH_UNAVAILABLE', 'Sign-in verification is unavailable. Please retry.');
    }
    if (!categories) return errorResponse(response, 503, 'SUGGESTION_UNAVAILABLE', 'Category suggestions are not available right now.');
    const title = parseCategoryRequest(request.body);
    if (title === null) return errorResponse(response, 400, 'INVALID_REQUEST', `Send only a title of 1–${MAX_TITLE_LENGTH} characters.`);
    if (!allowRequest(categoryRequests, token, categories.now?.() ?? Date.now(), categories.rateLimit ?? CATEGORY_RATE_LIMIT)) {
      return errorResponse(response, 429, 'RATE_LIMITED', 'Too many suggestion requests. Please wait a moment.');
    }
    let history: LabelledExpense[];
    try {
      ({ history } = await categories.loadHistory(token));
    } catch {
      return errorResponse(response, 503, 'HISTORY_UNAVAILABLE', 'Your expense history could not be loaded. Please retry.');
    }
    return response.json(suggestCategory(history, title));
  });

  // Timetable import: returns an editable draft only. Nothing is saved, and the upload,
  // OCR text, and draft are never stored or logged.
  app.post('/api/timetable/import', async (request: Request, response: Response) => {
    const token = bearerToken(request);
    if (!token) return errorResponse(response, 401, 'UNAUTHORIZED', 'A valid sign-in is required.');
    try {
      if (!(await verifyToken(token))) return errorResponse(response, 401, 'UNAUTHORIZED', 'A valid sign-in is required.');
    } catch {
      return errorResponse(response, 503, 'AUTH_UNAVAILABLE', 'Sign-in verification is unavailable. Please retry.');
    }
    if (!readTimetable) return errorResponse(response, 503, 'TIMETABLE_UNAVAILABLE', 'Timetable import is not available right now.');
    if (!request.is('multipart/form-data')) return errorResponse(response, 415, 'INVALID_UPLOAD', 'Send one timetable file as multipart form data.');

    timetableUpload(request, response, async (uploadError?: unknown) => {
      if (uploadError) {
        if (uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE') {
          return errorResponse(response, 413, 'FILE_TOO_LARGE', 'The file must be 5 MB or smaller.');
        }
        if (uploadError instanceof Error && uploadError.message === 'UNSUPPORTED_FILE') {
          return errorResponse(response, 415, 'UNSUPPORTED_FILE', 'Use a PNG, JPEG, or PDF file.');
        }
        return errorResponse(response, 400, 'INVALID_UPLOAD', 'Send exactly one file in the file field.');
      }
      const upload = request.file;
      if (!upload || upload.size === 0) return errorResponse(response, 400, 'MISSING_FILE', 'Choose a timetable file.');
      if (actualMime(upload.buffer) !== upload.mimetype) {
        return errorResponse(response, 415, 'UNSUPPORTED_FILE', 'Use a valid PNG, JPEG, or PDF file.');
      }
      const kind = upload.mimetype === 'application/pdf' ? 'pdf' : 'image';
      if (kind === 'pdf') {
        // Password-protected or truncated PDFs are refused before any OCR request.
        if (upload.buffer.includes('/Encrypt')) return errorResponse(response, 422, 'PDF_PROTECTED', 'Password-protected PDFs are not supported.');
        if (!upload.buffer.includes('%%EOF')) return errorResponse(response, 422, 'INVALID_DOCUMENT', 'The PDF could not be read.');
      }
      try {
        const { pages, totalPages } = await readTimetable(upload.buffer, kind);
        const usedPages = pages.slice(0, TIMETABLE_MAX_PDF_PAGES);
        const { candidates, warnings } = parseTimetable(usedPages);
        if (totalPages > TIMETABLE_MAX_PDF_PAGES) warnings.push('PAGES_TRUNCATED');
        response.json({ candidates, warnings, pagesProcessed: usedPages.length, totalPages });
      } catch (error) {
        if (error instanceof TimetableDocumentError) return errorResponse(response, 422, 'INVALID_DOCUMENT', 'The file could not be read.');
        // Provider details, document content, and tokens never reach clients or logs.
        errorResponse(response, 502, 'OCR_UNAVAILABLE', 'The timetable could not be read. Please retry or add classes manually.');
      }
    });
  });

  return app;
}
