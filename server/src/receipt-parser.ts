import { extractDate } from './receipt-date.js';
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
  const date = extractDate(lines, rows);
  const purchaseDate = date.value;
  const total = extractTotal(lines, rows, text);
  const totalAmount = total.value;
  const warnings: string[] = [];
  if (!text) warnings.push('No readable text was detected.');
  if (!merchantName || merchant.review) warnings.push('Merchant name needs review.');
  if (!purchaseDate || date.review) warnings.push('Purchase date needs review.');
  if (totalAmount === null || total.review) warnings.push('Total amount needs review.');
  return { merchantName, purchaseDate, totalAmount, rawText: text, warnings };
}
