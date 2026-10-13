// Offline receipt OCR evaluation. Compares parser output with hand-made labels.
// Pure functions only: the CLI scripts in scripts/ handle files and Google Vision.

import { createHash } from 'node:crypto';

import type { ReceiptResult } from './receipt-parser.js';

export const RECEIPT_TYPES = ['chain_retail', 'food_beverage', 'local_shop', 'handwritten', 'digital', 'other'] as const;
export const RECEIPT_CONDITIONS = ['clean', 'hard'] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];
export type ReceiptCondition = (typeof RECEIPT_CONDITIONS)[number];

export type ReceiptLabel = {
  file: string;
  type: ReceiptType;
  condition: ReceiptCondition;
  merchant: string | null;
  date: string | null;
  total: number | null;
};

export type Field = 'merchant' | 'date' | 'total';
export const FIELDS: readonly Field[] = ['merchant', 'date', 'total'];
// correct: matches the label. flagged: wrong, but the review warning was shown.
// silent: wrong with no warning, the outcome that most needs fixing.
export type Outcome = 'correct' | 'flagged' | 'silent';

/** Splits one CSV line, honouring double-quoted fields ("Kedai Ali, Pekan"). */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { cells.push(cell); cell = ''; }
    else cell += char;
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

const DATE_LABEL = /^\d{4}-\d{2}-\d{2}$/;

/** Reads the labels CSV. Blank lines and lines starting with # are ignored. Throws on any invalid row. */
export function parseLabelsCsv(csv: string): ReceiptLabel[] {
  const lines = csv.split(/\r?\n/).map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.trim() && !line.trim().startsWith('#'));
  const [header, ...rows] = lines;
  const expected = 'file,type,condition,merchant,date,total';
  if (!header || splitCsvLine(header.line).join(',') !== expected) throw new Error(`The first row must be: ${expected}`);
  const seen = new Set<string>();
  return rows.map(({ line, number }) => {
    const cells = splitCsvLine(line);
    const fail = (message: string): never => { throw new Error(`Line ${number}: ${message}`); };
    if (cells.length !== 6) fail(`expected 6 columns, found ${cells.length}`);
    const [file, type, condition, merchant, date, total] = cells as [string, string, string, string, string, string];
    if (!file) fail('file is required');
    if (seen.has(file)) fail(`duplicate file ${file}`);
    seen.add(file);
    if (!(RECEIPT_TYPES as readonly string[]).includes(type)) fail(`type must be one of ${RECEIPT_TYPES.join(', ')}`);
    if (!(RECEIPT_CONDITIONS as readonly string[]).includes(condition)) fail(`condition must be clean or hard`);
    if (date && !DATE_LABEL.test(date)) fail('date must be YYYY-MM-DD, or blank when the receipt shows none');
    const amount = total ? Number(total.replace(/^RM\s*/i, '')) : null;
    if (amount !== null && !(Number.isFinite(amount) && amount > 0)) fail('total must be a positive number such as 12.50, or blank');
    return { file, type: type as ReceiptType, condition: condition as ReceiptCondition, merchant: merchant || null, date: date || null, total: amount };
  });
}

/**
 * About 20% of receipts are held out for the final score. The choice depends only
 * on the file name, so it never changes when receipts are added or the parser changes.
 */
export function isTestSample(file: string): boolean {
  return createHash('sha256').update(file).digest()[0]! < 52; // 52 / 256 ≈ 20%
}

const COMPANY_WORDS = new Set(['sdn', 'bhd', 'berhad', 'sendirian', 'plc', 'ltd', 'co', 'm/s', 'ms']);
/** Lowercase words without punctuation or company suffixes such as "Sdn Bhd". */
export function merchantTokens(name: string): string[] {
  return name.toLowerCase().replace(/[^\p{L}\p{N}/\s]/gu, ' ').split(/\s+/).filter((word) => word && !COMPANY_WORDS.has(word));
}

/**
 * The parsed merchant is correct when its words begin with the labelled name, so
 * "TEALIVE @ UMP PEKAN" matches the label "Tealive". "WELCOME TO MYDIN" does not.
 */
export function merchantMatches(parsed: string | null, label: string | null): boolean {
  if (label === null) return parsed === null;
  if (parsed === null) return false;
  const want = merchantTokens(label);
  const got = merchantTokens(parsed);
  return want.length > 0 && want.every((word, index) => got[index] === word);
}

function fieldCorrect(field: Field, result: ReceiptResult, label: ReceiptLabel): boolean {
  if (field === 'merchant') return merchantMatches(result.merchantName, label.merchant);
  if (field === 'date') return result.purchaseDate === label.date;
  if (label.total === null || result.totalAmount === null) return label.total === result.totalAmount;
  return Math.abs(result.totalAmount - label.total) < 0.005;
}

const WARNING_FOR: Record<Field, RegExp> = { merchant: /merchant/i, date: /date/i, total: /total|amount/i };

export type ScoredReceipt = {
  label: ReceiptLabel;
  split: 'dev' | 'test';
  outcomes: Record<Field, Outcome>;
  got: { merchant: string | null; date: string | null; total: number | null };
};

export function scoreReceipt(label: ReceiptLabel, result: ReceiptResult): ScoredReceipt {
  const outcomes = {} as Record<Field, Outcome>;
  for (const field of FIELDS) {
    const flagged = result.warnings.some((warning) => WARNING_FOR[field].test(warning));
    outcomes[field] = fieldCorrect(field, result, label) ? 'correct' : flagged ? 'flagged' : 'silent';
  }
  return {
    label, split: isTestSample(label.file) ? 'test' : 'dev', outcomes,
    got: { merchant: result.merchantName, date: result.purchaseDate, total: result.totalAmount },
  };
}

export type FieldStats = { correct: number; flagged: number; silent: number; accuracy: number };
export type GroupStats = { count: number; fields: Record<Field, FieldStats>; allCorrect: number; allCorrectRate: number };

const rate = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

/** Per-field accuracy plus the share of receipts with all three fields correct (percentages, 1 dp). */
export function summarize(scored: ScoredReceipt[]): GroupStats {
  const fields = {} as Record<Field, FieldStats>;
  for (const field of FIELDS) {
    const counts = { correct: 0, flagged: 0, silent: 0 };
    for (const receipt of scored) counts[receipt.outcomes[field]]++;
    fields[field] = { ...counts, accuracy: rate(counts.correct, scored.length) };
  }
  const allCorrect = scored.filter((receipt) => FIELDS.every((field) => receipt.outcomes[field] === 'correct')).length;
  return { count: scored.length, fields, allCorrect, allCorrectRate: rate(allCorrect, scored.length) };
}

export function groupBy<K extends string>(scored: ScoredReceipt[], key: (receipt: ScoredReceipt) => K): Map<K, ScoredReceipt[]> {
  const groups = new Map<K, ScoredReceipt[]>();
  for (const receipt of scored) groups.set(key(receipt), [...(groups.get(key(receipt)) ?? []), receipt]);
  return groups;
}
