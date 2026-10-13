import { receiptRows } from './receipt-layout.js';
import { extractMerchant } from './receipt-merchant.js';
import { extractTotal } from './receipt-total.js';
import type { OcrPage } from './timetable-parser.js';

export type ReceiptResult = {
  merchantName: string | null;
  purchaseDate: string | null;
  totalAmount: number | null;
  rawText: string;
  warnings: string[];
};

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function extractDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const local = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2}|\d{2})\b/);
  if (!local) return null;
  const year = Number(local[3]);
  return validDate(year < 100 ? 2000 + year : year, Number(local[2]), Number(local[1]));
}

/**
 * Reads merchant, date, and total from Vision's text. `pages` (word boxes from the same Vision call) let the
 * parser rebuild printed rows; without them it uses the text order alone.
 */
export function parseReceiptText(rawText: string, pages?: readonly OcrPage[]): ReceiptResult {
  const text = rawText.trim();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = receiptRows(pages);
  const merchant = extractMerchant(lines);
  const merchantName = merchant.value;
  const purchaseDate = extractDate(text);
  const total = extractTotal(lines, rows, text);
  const totalAmount = total.value;
  const warnings: string[] = [];
  if (!text) warnings.push('No readable text was detected.');
  if (!merchantName || merchant.review) warnings.push('Merchant name needs review.');
  if (!purchaseDate) warnings.push('Purchase date needs review.');
  if (totalAmount === null || total.review) warnings.push('Total amount needs review.');
  return { merchantName, purchaseDate, totalAmount, rawText: text, warnings };
}
