// Purchase date extraction for receipts. Pure functions, used by receipt-parser.ts.

import type { Extracted } from './receipt-merchant.js';

// English and Malay month names by their first three letters.
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, mac: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, ogo: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dis: 12,
};
// Digits OCR commonly reads in place of letters. Used only for the month word inside a date ("100CT2026").
const LETTER_FOR_DIGIT: Record<string, string> = { '0': 'o', '1': 'i', '5': 's', '8': 'b' };

// A date beside one of these is the purchase date; beside a due, payment-deadline, or expiry label it never is.
const DATE_LABEL = /\b(date|tarikh|dated|issued|transaction|trans)\b/i;
const NOT_PURCHASE = /\b(due|bayar\s+sebelum|pay\s+before|sebelum|expiry|expires?|exp|valid|luput|tamat|until|hingga|period|tempoh)\b/i;
const TIME = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?\b/i;

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

type Found = { iso: string; fullYear: boolean; corrected: boolean };

/** Every date written in the line: ISO, day/month/year (Malaysian order), or day with a month name. */
function datesIn(line: string): Found[] {
  const found: Found[] = [];
  const year = (value: string) => (value.length === 2 ? 2000 + Number(value) : Number(value));
  for (const match of line.matchAll(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g)) {
    const iso = validDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (iso) found.push({ iso, fullYear: true, corrected: false });
  }
  for (const match of line.matchAll(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2}|\d{2})\b/g)) {
    const iso = validDate(year(match[3]!), Number(match[2]), Number(match[1]));
    if (iso) found.push({ iso, fullYear: match[3]!.length === 4, corrected: false });
  }
  // "04/Aug/2025", "14 Oct 2025", "05 JUN 2025", "17 Jun 2026", or the misread "100CT2026".
  for (const match of line.matchAll(/(?<!\d)(0?[1-9]|[12]\d|3[01])\s*[-/. ]?\s*([A-Za-z0-9][A-Za-z]{2})[A-Za-z]*\.?\s*[-/., ']?\s*(20\d{2}|\d{2})(?!\d)/g)) {
    const word = match[2]!;
    if (!/[A-Za-z]/.test(word.slice(1))) continue;
    const fixed = (LETTER_FOR_DIGIT[word[0]!] ?? word[0]!.toLowerCase()) + word.slice(1).toLowerCase();
    const month = MONTHS[fixed];
    if (!month) continue;
    const iso = validDate(year(match[3]!), month, Number(match[1]));
    if (iso) found.push({ iso, fullYear: match[3]!.length === 4, corrected: /\d/.test(word[0]!) });
  }
  return found;
}

/**
 * Candidates from a list of rows or lines, scored by context: +2 beside a date label (same or previous line),
 * +1 beside a time. Dates beside due, payment-deadline, or expiry labels are skipped.
 */
function candidates(lines: readonly string[]) {
  const out: { found: Found; score: number; index: number }[] = [];
  lines.forEach((line, index) => {
    const previous = lines[index - 1] ?? '';
    if (NOT_PURCHASE.test(line) || (NOT_PURCHASE.test(previous) && !DATE_LABEL.test(line))) return;
    for (const found of datesIn(line)) {
      const labelled = DATE_LABEL.test(line) || (DATE_LABEL.test(previous) && !NOT_PURCHASE.test(previous)) || (index >= 2 && /^\s*(date|tarikh)\s*:?\s*$/i.test(lines[index - 2]!));
      out.push({ found, score: (labelled ? 2 : 0) + (TIME.test(line) ? 1 : 0), index });
    }
  });
  return out;
}

/**
 * The purchase date. The best-supported candidate wins (the earliest on ties). It is confident only with
 * context (a date label or a time beside it), a four-digit year, and no OCR correction; otherwise it is kept
 * but flagged, as is a handwritten-style "11/8/23".
 */
export function extractDate(lines: readonly string[], rows: readonly string[]): Extracted<string> {
  const all = [...candidates(rows), ...candidates(lines)];
  if (!all.length) return { value: null, review: true };
  const best = all.reduce((top, candidate) => (candidate.score > top.score ? candidate : top));
  return { value: best.found.iso, review: best.score === 0 || !best.found.fullYear || best.found.corrected };
}
