// Total (amount actually paid) extraction for receipts. Pure functions, used by receipt-parser.ts.

import type { Extracted } from './receipt-merchant.js';

// Labels, strongest first. A final label (after rounding, discounts, or subsidies) beats a plain "Total".
const FINAL_TOTAL = /\b(grand\s*total|nett?\s*total|total\s*net|rounded\s*total|total\s*(?:after|selepas)\s*round\w*|total\s*payable|total\s*payment|total\s*\(?\s*incl\w*\.?\s*(?:of\s*)?(?:tax|sst|gst)|amount\s*(?:due|payable)|total\s*due|j[ua][mn]lah\s*(?:bayaran\s*)?(?:akhir|besar|keseluruhan)|anda\s*bayar|you\s*pay)\b/i;
const NAMED_TOTAL = /\b(total\s*amount|total\s*\(?\s*(?:rm|myr)\s*\)?|j[ua][mn]lah(?:\s*bayaran)?)\b/i;
const PLAIN_TOTAL = /\btotal\b/i;
// Never the paid total: subtotals, item counts, savings, taxes, tendered cash, change, and rounding lines.
const NOT_TOTAL = /\b(sub\s*-?\s*total|subtotal|item\s*total|gross\s*total|total\s*(?:items?|qty|quantity|savings?|saved|discount|disc|tax|sst|gst|received|tendered|points?|weight)|j[ua][mn]lah\s*(?:item|kuantiti|barang)|tax|sst|gst|change|baki|cash|tunai|tendered|received|rounding|service\s*charge|qty)\b/i;
const DECIMAL = /(?:RM\s*)?(\d{1,3}(?:,\d{3})+|\d+)[.,](\d{2})(?!\d)/gi;
// Non-cash payments (card, QR, e-wallet) are charged exactly the amount paid; cash is not (it includes change).
const NON_CASH = /\b(duit\s*now|touch\s*['’]?\s*n\s*go|tng|e-?wallet|grab\s*pay|shopee\s*pay|boost|visa|master\s*card|master|amex|maybank\s*(?:qr|or)|qr\s*pay|debit\s*card|credit\s*card|mpay|online\s*banking)\b/i;
const NOT_PAYMENT = /\b(card\s*(?:no|num|number|type|desc|exp)|points?|balance|approv|app\s*id|aid|rewards?)\b/i;
const CASH = /^\s*(?:cash|tunai)\b/i;
const CHANGE = /^\s*(?:change|baki)\b/i;
// Common OCR slips inside the word "total" ("Tctal", "T0tal").
const repairOcr = (line: string) => line.replace(/\bt[c0]tal\b/gi, 'Total');
const AMOUNT_ONLY = /^(?:RM\s*)?\d[\d,]*(?:[.,]\d{2})?(?:\s*\/[=-]?)?\s*$/i;

// Not a completed purchase: an unpaid order slip or an outstanding bill, so no amount has been paid.
const UNPAID = /\b(unpaid|belum\s+dibayar|not\s+paid|pending\s+payment)\b/i;
const BILL_TERMS = [/\bbayar\s+sebelum\b/i, /\bpay\s+before\b/i, /\b(?:payment\s+)?due\s+date\b/i, /\btunggakan\b/i, /\btertunggak\b/i, /\boutstanding\b/i,
  /\bjumlah\s+perlu\s+dibayar\b/i, /\bamount\s+payable\s+by\b/i];

/** An unpaid order or an outstanding bill (two or more separate bill phrases), which has no paid total. */
export function isUnpaidDocument(text: string): boolean {
  return UNPAID.test(text) || BILL_TERMS.filter((term) => term.test(text)).length >= 2;
}

/** 3 for a final label, 2 for a named total, 1 for a plain "Total", 0 for anything else (including subtotals and change). */
const rank = (line: string) => FINAL_TOTAL.test(line) ? 3 : NOT_TOTAL.test(line) ? 0 : NAMED_TOTAL.test(line) ? 2 : PLAIN_TOTAL.test(line) ? 1 : 0;

/** The amount printed after the label on its own row, or in a tight context with `review`. */
function amountAfterLabel(rest: string): Extracted<number> {
  const decimal = [...rest.matchAll(DECIMAL)].at(-1);
  if (decimal) {
    const value = Number(`${decimal[1]!.replaceAll(',', '')}.${decimal[2]}`);
    if (value > 0) return { value, review: false };
  }
  // The decimal point was lost between two words ("RM 24 60"): only an integer and exactly two digits at the end.
  const split = rest.match(/(?:^|\s)(?:RM\s*)?(\d{1,4})\s+(\d{2})\s*$/i);
  if (split) return { value: Number(`${split[1]}.${split[2]}`), review: true };
  // Handwritten receipts may write RM88 as "88/=" or leave a stray mark after it; a draft that needs review.
  const integer = rest.match(/(?:^|[\s:/])(?:RM\s*)?(\d{1,3}(?:,\d{3})*|\d+)(?:\s*\/[=-]?)?(?:\s+\S{1,2})?\s*$/i);
  if (integer) {
    const value = Number(integer[1]!.replaceAll(',', ''));
    if (value > 0) return { value, review: true };
  }
  return { value: null, review: true };
}

/**
 * The best labelled total, strongest label first and the lowest such row on ties. `nextLine` allows an amount alone
 * on the following line, which suits Vision's text order but not rows rebuilt from positions: there the next row is
 * a different printed line (for example the cash tendered on a tilted photo). It is 'review' when word positions
 * exist but did not confirm the pairing, so such a value is never presented as certain.
 */
function labelledTotal(source: readonly string[], nextLine: false | 'confident' | 'review'): Extracted<number> {
  const rows = source.map(repairOcr);
  let best: { rank: number; index: number; amount: Extracted<number> } | null = null;
  rows.forEach((row, index) => {
    const strength = rank(row);
    if (!strength) return;
    const label = FINAL_TOTAL.exec(row) ?? NAMED_TOTAL.exec(row) ?? PLAIN_TOTAL.exec(row);
    let amount = amountAfterLabel(row.slice((label?.index ?? 0) + (label?.[0].length ?? 0)));
    // Vision often places the payable amount on the next line; only an amount alone there is used.
    const next = rows[index + 1];
    if (amount.value === null && nextLine && next && AMOUNT_ONLY.test(next)) {
      amount = amountAfterLabel(next);
      if (nextLine === 'review') amount = { ...amount, review: true };
    }
    if (amount.value === null) return;
    if (!best || strength > best.rank || (strength === best.rank && index > best.index)) best = { rank: strength, index, amount };
  });
  return best ? (best as { amount: Extracted<number> }).amount : { value: null, review: true };
}

/**
 * The amount actually paid. Rows rebuilt from word positions pair a label with the amount printed beside it;
 * without positions (or when rows find nothing) the text lines are used, as before. Subtotals, tendered cash,
 * change, and other amounts are never used. Unpaid orders and outstanding bills have no paid total.
 */
export function extractTotal(lines: readonly string[], rows: readonly string[], text: string): Extracted<number> {
  if (isUnpaidDocument(text)) return { value: null, review: true };
  const fromRows = rows.length ? labelledTotal(rows, false) : { value: null, review: true };
  const labelled = fromRows.value !== null ? fromRows : labelledTotal(lines, rows.length ? 'review' : 'confident');
  const sources = rows.length ? [rows, lines] : [lines];
  const charged = sources.map(nonCashPayment).find((value) => value !== null) ?? null;
  if (labelled.value !== null) {
    // A card or e-wallet charge that disagrees with the labelled total means one of them was misread.
    return charged !== null && Math.abs(charged - labelled.value) > 0.05 ? { ...labelled, review: true } : labelled;
  }
  // No labelled total: the non-cash charge, or cash minus change. Never presented as certain.
  const fallback = charged ?? sources.map(cashMinusChange).find((value) => value !== null) ?? null;
  return { value: fallback, review: true };
}

/** A decimal amount printed on the row (the last one), or null. Integers are not trusted here. */
function decimalOn(row: string): number | null {
  const match = [...row.matchAll(DECIMAL)].at(-1);
  // "RM20 90": the point was lost after a currency mark, so the last two digits are still the cents.
  const split = match ? null : row.match(/RM\s*(\d{1,4})\s+(\d{2})\s*$/i);
  const value = match ? Number(`${match[1]!.replaceAll(',', '')}.${match[2]}`) : split ? Number(`${split[1]}.${split[2]}`) : 0;
  return value > 0 ? value : null;
}

/** The amount on the lowest card, QR, or e-wallet payment row; card numbers, approvals, and points are skipped. */
function nonCashPayment(rows: readonly string[]): number | null {
  for (const row of [...rows].reverse()) {
    if (!NON_CASH.test(row) || NOT_PAYMENT.test(row) || rank(row)) continue;
    const value = decimalOn(row);
    if (value !== null) return value;
  }
  return null;
}

/** Cash tendered minus change given, when both rows carry an amount and the result is positive. */
function cashMinusChange(rows: readonly string[]): number | null {
  const cashRow = rows.find((row) => CASH.test(row) && decimalOn(row) !== null);
  const changeRow = rows.find((row) => CHANGE.test(row) && decimalOn(row) !== null);
  if (!cashRow || !changeRow) return null;
  const cents = Math.round(decimalOn(cashRow)! * 100) - Math.round(decimalOn(changeRow)! * 100);
  return cents > 0 ? cents / 100 : null;
}
