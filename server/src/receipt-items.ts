// Line items for the receipt review. Additive: merchant, date, and total extraction (receipt-parser.ts) are untouched,
// and the evaluation never sees this module. Pure functions, used by the receipt endpoint in app.ts.
//
// Items are a review aid for the student: a name, a quantity, the unit price when printed, and the line amount
// (negative for a discount). Anything that cannot be read with confidence is left out, and the list is emptied
// when the lines read do not plausibly make up the receipt's total.

import { receiptRows } from './receipt-layout.js';
import type { ReceiptResult } from './receipt-parser.js';
import { isUnpaidDocument } from './receipt-total.js';
import type { OcrPage } from './timetable-parser.js';

export type ReceiptItem = { name: string; quantity: number; unitPrice: number | null; amount: number };
export const ITEMS_INCOMPLETE = 'Items may be incomplete.';

const TOLERANCE_CENTS = 5;
// The lines read must come to within 40% of the total; further away they are not a fair reading of the receipt.
const PLAUSIBLE_SHARE = 0.4;
const MAX_ITEMS = 200;
const MAX_NAME = 120;

// An amount at the end of a row, with optional RM, a minus sign, and a trailing tax/flag code ("3.80 - T", "7.49 D").
const AMOUNT = String.raw`(-\s?)?(?:RM\s?)?(-\s?)?(\d{1,3}(?:,\d{3})+|\d*)[.,](\d{2})`;
const FLAG = String.raw`(?:\s*[-–]?\s*(?:[A-Z]{1,2}|\*))?`;
const TRAILING_AMOUNT = new RegExp(String.raw`(?:^|\s)${AMOUNT}${FLAG}\s*$`, 'i');
// "1x7.30", "1 X 2.00", "2 × 12.50", "1 * 8.80", "0.500x9.90" (a weight), followed by optional discount and amount columns.
const QTY_X_UNIT = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*[x×X*]\s*(\d*[.,]\d{2})(?=\s|$)/;
// "12.50 2 0.00 25.00": unit price, quantity, discount, amount.
const PRICE_QTY_DISC_AMOUNT = /^(\d*[.,]\d{2})\s+(\d{1,3})\s+(\d*[.,]\d{2})\s+(\d*[.,]\d{2})$/;
// "… 1 14.50" before the amount, or "@ 15.00 x1" inside the name: a quantity and unit price.
const QTY_UNIT_TAIL = /(?:^|\s)(\d{1,3})\s+(\d*[.,]\d{2})$/;
const AT_UNIT = /@\s*(?:RM\s*)?(\d*[.,]\d{2})\s*[x×X]\s*(\d{1,3})\b/i;
// "02 5.99 -1.50": a promotion under the item it applies to (promo code, new price, discount).
const PROMO_LINE = /^\d{1,2}\s+\d*[.,]\d{2}\s+-\s?(\d*[.,]\d{2})$/;
const PROMO_PRICE_ONLY = /^\d{1,2}\s+\d*[.,]\d{2}$/;
const LEADING_QTY = /^(\d{1,3})\s+(?=\S*[A-Za-z])/;
const PRICE_IN_TEXT = /\d[.,]\d{2}(?!\d)/;

// The items end at the first summary row.
const SUMMARY = /\b(sub\s*-?\s*total|total|jumlah|item\s*\(\s*s\s*\)|items?\s*[:#]?\s*\d+\b|item\s*count|no\.?\s*(?:of\s*)?(?:qtys?|items?)|qty\s*\(\s*s\s*\)|bil\.?\s*item|units?\s*sold)/i;
// Header rows before the items: dates, times, staff, table, order and document numbers, and column headings.
const HEADER = /\b(date|tarikh|time|masa|cashier|kasir|staff|table|meja|pax|order|invoice|inv|receipt|rcpt|bill|register|counter|terminal|pos\s*#?|shift|description|particulars|item\s+qty|qty\s+price|barcode\s+item)\b|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\b\d{4}[/.-]\d{1,2}[/.-]\d{1,2}\b|\b\d{1,2}:\d{2}\b/i;
const DATE_OR_TIME = /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\b\d{1,2}:\d{2}\b/;
// Lines that are never items. Labels are matched at the start of the line, so product names such as
// "SAMPLE RICE SUPER GRADE SST" or "GARBAGE BAG" are kept; strong phrases are matched anywhere.
const EXCLUDED_START = /^(sub\s*-?\s*total|total|grand|nett?\s*total|amount|jumlah|cash|tunai|change|baki|tender(?:ed)?|received|rounding|rounded|round\s*adj|adjustment|tax|sst|gst|service\s*charge|serv\.?\s*tax|servis|savings?|spec\.?\s*disc|disc\s|e-?wallet|tng|touch\s*'?n\s*go|visa|master(?:card)?|amex|mydebit|my\s*debit|debit|credit|card|edc|boost|grab\s*pay|shopee\s*pay|duitnow|qr\s*[pf]ay|maybank|cimb|custom\s*pay|others|approv\w*|auth\w*|terminal|merchant|batch|trace|rrn|ref\b|items?\s*(?:\(|\d|count)|qtys?\b|no\.?\s*(?:of|qtys?|items?)\b|pax|cashier|kasir|staff|table|order|invoice|receipt|rcpt|bill\s*no|tel\b|fax|phone|thank|terima|please|sila|welcome|selamat\s*datang|member|points?|void|balance|bal\b|pump\s*price|subsidy\s*(?:information|price)|previous\s*bal\w*|remaining|mykad|payment|units?\s*sold)(?![a-z])/i;
const EXCLUDED_ANYWHERE = /\b(sub\s*-?\s*total|grand\s*total|net\s*total|total\s*(?:amount|sales|due|rm|items?|qty)|change\s*due|thank\s*you|terima\s*kasih|e-?wallet|approval\s*code|card\s*no|jalan|jln|lorong|taman|kawasan|seksyen|perindustrian|sdn\.?\s*bhd|berhad)\b|\b\d{5}\s+[A-Z][A-Za-z]+/i;
// Short words OCR often truncates or misreads; a lone word close to one of these is a damaged summary label ("otal", "nge").
const LABEL_WORDS = ['total', 'subtotal', 'item', 'items', 'change', 'cash', 'rounding', 'tendered', 'balance', 'amount', 'saving', 'jumlah', 'tunai', 'baki'];
const DISCOUNT = /\b(promo(?:tion)?|discount|disc|diskaun|potongan|subsidy|rebate|voucher|coupon|offer|less|member\s*price)\b/i;
// Packaging and unit words printed beside barcodes; on their own they are not a product name.
const UNIT_WORDS = new Set(['pkt', 'pack', 'bag', 'ctn', 'unit', 'kg', 'g', 'btl', 'tube', 'tray', 'box', 'u', 'c', 'p', 'o', 'd', 'n', 'ea', 'pcs', 'pc', 'x', 'set', 'can', 'bot', 'rm']);

const cents = (whole: string, decimals: string) => Number(whole.replaceAll(',', '') || '0') * 100 + Number(decimals);
const decimalCents = (value: string) => { const [whole, decimals] = value.split(/[.,]/) as [string, string]; return cents(whole, decimals); };
const toAmount = (value: number) => Math.round(value) / 100;
const letters = (text: string) => (text.match(/\p{L}/gu) ?? []).length;

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length]!;
}

/** A damaged summary label: one or two short words that are a fragment of, or one letter away from, a label word. */
export function isTruncatedLabel(name: string): boolean {
  const words = name.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 2) return false;
  return words.every((word) => word.length >= 3 && LABEL_WORDS.some((label) =>
    ((label.startsWith(word) || label.endsWith(word)) && word.length < label.length) || (word.length >= 4 && editDistance(word, label) <= 1)));
}

/** A summary, payment, tax, change, count, address, staff, or document line, including damaged labels. */
export function isExcludedLine(text: string): boolean {
  const trimmed = text.trim().replace(/^[\s*•·#>(-]+/, '');
  return EXCLUDED_START.test(trimmed) || EXCLUDED_ANYWHERE.test(trimmed) || isTruncatedLabel(trimmed);
}

/** Tidies an OCR name: no barcodes, codes, bullets, "@ price" notes, or stray marks, and normal spacing around punctuation. */
export function cleanName(raw: string): string {
  return raw
    .replace(/\s@.*$/, '')
    .replace(/^[\s*•·#>-]+/, '')
    .replace(/^\d{5,}\s*-\s*/, '')
    .replace(/^\d{4,}\s+(?=\S*[A-Za-z])/, '')
    .replace(/\b\d{8,}\b/g, ' ')
    .replace(/\s+([,.)\]:;'])/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .replace(/\s+[-–]\s*$/, '')
    .replace(/["@]+\s*$/, '')
    .replace(/\s+[a-z]$/, '')
    .replace(/^([^[]*)\]\s*$/, '$1')
    .replace(/^([^(]*)\)\s*$/, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
}

/**
 * A product name from OCR text, or '' when the text is not one: it must not contain a price (a misread line), must
 * have real words beyond barcodes, codes, and unit words, and must not be a summary, payment, or address line.
 */
export function usableName(raw: string): string {
  const name = cleanName(raw);
  if (!name || PRICE_IN_TEXT.test(name) || isExcludedLine(name)) return '';
  const words = name.split(/\s+/).filter((word) => !UNIT_WORDS.has(word.toLowerCase().replace(/[^a-z]/g, '')));
  const plain = words.filter((word) => !/\d/.test(word)).reduce((sum, word) => sum + letters(word), 0);
  const all = words.reduce((sum, word) => sum + letters(word), 0);
  // Bare numbers outnumbering the words ("B Smp (14) 14 42") mean a misread line, not a name.
  const numbers = words.filter((word) => /^\(?\d+\)?[.,/]?$/.test(word)).length;
  const named = words.filter((word) => letters(word) > 0).length;
  const longestRun = Math.max(0, ...(name.match(/\p{L}+/gu) ?? []).map((run) => run.length));
  return (plain >= 3 || all >= 5 || longestRun >= 4) && numbers <= named ? name : '';
}

/** `computed`: the amount was not printed legibly and comes from "qty × unit"; it counts only when the receipt then adds up. */
export type ItemDraft = { name: string; quantity: number; unitCents: number | null; amountCents: number; barcode: string | null; computed?: boolean };

/** The amount at the end of a row and the text before it, or null when the row does not end in an amount. */
function trailingAmount(row: string): { text: string; cents: number } | null {
  const match = TRAILING_AMOUNT.exec(row);
  if (!match) return null;
  const negative = !!(match[1] || match[2]);
  const value = cents(match[3]!, match[4]!);
  if (value <= 0 || value >= 10_000_000) return null;
  return { text: row.slice(0, match.index).trim(), cents: negative ? -value : value };
}

/** A "qty × unit [disc] amount" detail row: quantity, unit price, printed line amount (or null), the text before it, and any barcode. */
function detailRow(row: string) {
  const match = QTY_X_UNIT.exec(row);
  if (!match) return null;
  const quantity = Number(match[1]!.replace(',', '.'));
  const after = row.slice(match.index + match[0].length).trim().split(/\s+/).filter((token) => /^-?\d*[.,]\d{2}$/.test(token));
  const last = after.at(-1);
  const before = row.slice(0, match.index).trim();
  return { quantity, unitCents: decimalCents(match[2]!), amountCents: last ? decimalCents(last.replace('-', '')) : null, before, barcode: before.match(/\b\d{7,}\b/)?.[0] ?? null };
}

const isSummary = (row: string) => SUMMARY.test(row) || isTruncatedLabel(trailingAmount(row)?.text ?? row);
const isPriced = (row: string) => !!trailingAmount(row) || QTY_X_UNIT.test(row) || PRICE_QTY_DISC_AMOUNT.test(row);

/**
 * The item rows: from just after the last header row above the first priced row, to the first summary row after it.
 * Header-like words further down ("Tea Time") therefore never cut items off.
 */
function itemSection(rows: readonly string[]): string[] {
  const first = rows.findIndex((row) => isPriced(row) && !HEADER.test(row) && !isSummary(row) && !isExcludedLine(trailingAmount(row)?.text ?? row));
  if (first < 0) return [];
  let start = 0;
  for (let index = 0; index < first; index += 1) if (HEADER.test(rows[index]!)) start = index + 1;
  let end = rows.findIndex((row, index) => index > first && isSummary(row));
  if (end < 0) end = rows.length;
  return rows.slice(start, end);
}

/** Reads item drafts from receipt rows (printed rows from word positions, or text lines). Exported for tests. */
export function readItems(rows: readonly string[]): ItemDraft[] {
  const items: ItemDraft[] = [];
  let pending: string[] = [];
  const columnQty = rows.some((row) => /\b(item|description)\b.*\bqty\b/i.test(row) && /\b(price|amount|amt)\b/i.test(row));
  // The name above a detail row; a "* name" line wins over its modifier lines ("DINE IN, T5").
  const pendingLine = () => pending.filter((line) => /^\s*\*/.test(line)).at(-1) ?? pending.at(-1) ?? '';
  const pendingName = () => usableName(pendingLine().replace(LEADING_QTY, ''));
  // "2 SAMPLE ICED TEA" above a lone "7.20": the quantity printed with the name.
  const pendingQty = () => { const match = LEADING_QTY.exec(pendingLine()); return match && !match[1]!.startsWith('0') ? Number(match[1]) || 1 : 1; };
  const add = (draft: ItemDraft) => { if (draft.name && draft.amountCents !== 0) items.push(draft); pending = []; };

  for (const raw of itemSection(rows)) {
    const row = raw.trim();
    if (!row) continue;
    // A voided line and its reversal cancel out; neither is an item.
    if (/^void\b/i.test(row)) { pending = []; continue; }
    const promo = PROMO_LINE.exec(row);
    if (promo) {
      if (items.length) items.push({ name: 'Discount', quantity: 1, unitCents: null, amountCents: -decimalCents(promo[1]!), barcode: null });
      pending = [];
      continue;
    }
    if (PROMO_PRICE_ONLY.test(row)) { pending = []; continue; }

    const columns = PRICE_QTY_DISC_AMOUNT.exec(row);
    if (columns) {
      // The discount column is already inside the printed amount, so only the amount counts.
      const quantity = Number(columns[2]);
      add({ name: pendingName(), quantity: quantity >= 1 ? quantity : 1, unitCents: decimalCents(columns[1]!), amountCents: decimalCents(columns[4]!), barcode: null });
      continue;
    }

    const detail = detailRow(row);
    if (detail) {
      const inline = usableName(detail.before.split(/\s+/).filter((word) => !UNIT_WORDS.has(word.toLowerCase())).join(' '));
      const previous = items.at(-1);
      // "SAMPLE COOKIES … 7.30" then "2000000000080 PACK 1x7.30": the detail completes the item above.
      if (!inline && !pending.length && previous && detail.amountCents === null) {
        if (Number.isInteger(detail.quantity) && detail.quantity * detail.unitCents === previous.amountCents) { previous.quantity = detail.quantity; previous.unitCents = detail.unitCents; }
        previous.barcode ??= detail.barcode;
        continue;
      }
      const weighed = !Number.isInteger(detail.quantity) || detail.quantity < 1;
      // An illegible line amount ("25 00") is computed from "qty × unit", but only provisionally: a misread quantity
      // could invent an amount, so it is kept only if the receipt then adds up.
      if (detail.amountCents === null && weighed) { pending = []; continue; }
      // A repeated barcode line without a name is a second scan of the item above.
      const name = inline || pendingName() || (previous && detail.barcode && previous.barcode === detail.barcode ? previous.name : '');
      add({ name, quantity: weighed ? 1 : detail.quantity, unitCents: weighed ? null : detail.unitCents, amountCents: detail.amountCents ?? detail.quantity * detail.unitCents, barcode: detail.barcode, computed: detail.amountCents === null });
      continue;
    }

    const priced = trailingAmount(row);
    if (priced) {
      const text = priced.text;
      if (priced.cents < 0 || DISCOUNT.test(text)) {
        // "Fuel95" / "-10.00": a discount amount alone takes the name above it, or is simply a discount.
        const name = usableName(text) || (priced.cents < 0 && !text ? pendingName() || 'Discount' : '');
        if (name && !/\b(spec\.?\s*disc|saving)\b/i.test(name)) items.push({ name, quantity: 1, unitCents: null, amountCents: -Math.abs(priced.cents), barcode: null });
        pending = [];
        continue;
      }
      let rest = text;
      let quantity = 1;
      let unitCents: number | null = null;
      const leading = LEADING_QTY.exec(rest);
      if (leading) {
        // "09 Diesel B10 …" is a pump or line number, not a quantity.
        if (!leading[1]!.startsWith('0')) quantity = Number(leading[1]) || 1;
        rest = rest.slice(leading[0].length);
      }
      const at = AT_UNIT.exec(rest);
      const tail = QTY_UNIT_TAIL.exec(rest);
      if (at && Number(at[2]) * decimalCents(at[1]!) === priced.cents) { quantity = Number(at[2]); unitCents = decimalCents(at[1]!); }
      else if (tail && Number(tail[1]) >= 1 && Number(tail[1]) * decimalCents(tail[2]!) === priced.cents) {
        quantity = Number(tail[1]); unitCents = decimalCents(tail[2]!); rest = rest.slice(0, tail.index);
      } else if (columnQty && !leading) {
        const trailing = /\s(\d{1,3})$/.exec(rest);
        if (trailing) { quantity = Number(trailing[1]) || 1; rest = rest.slice(0, trailing.index); }
      }
      // A priced row without a usable name ("2000000000097 1.90 1.90", "3.00 - T") takes the name printed above it.
      const own = usableName(rest);
      if (!own && quantity === 1 && unitCents === null) quantity = pendingQty();
      add({ name: own || pendingName(), quantity, unitCents, amountCents: priced.cents, barcode: text.match(/\b\d{7,}\b/)?.[0] ?? null });
      continue;
    }

    // A row with no amount: the name (or a modifier) of the next priced row.
    if (letters(row) >= 2 && !DATE_OR_TIME.test(row) && !isExcludedLine(row.replace(LEADING_QTY, ''))) pending.push(row);
    else pending = [];
    if (pending.length > 4) pending = pending.slice(-4);
  }
  return items.slice(0, MAX_ITEMS);
}

/** Rounding, tax, and service charge printed on the receipt, which explain a gap between the items and the total. */
function adjustmentCents(rows: readonly string[]): number {
  let sum = 0;
  for (const row of rows) {
    if (!/\b(rounding|round\s*adj|service\s*charge|serv\.?\s*tax|sst|gst|tax)\b/i.test(row) || /\b(exc|excl|excluding|incl|inclusive|total|summary)\b/i.test(row)) continue;
    const amount = trailingAmount(row);
    if (amount) sum += amount.cents;
  }
  return sum;
}

/** A line's amount, or its "qty × unit" when `useUnit` and the printed amount disagrees with it. */
const lineCents = (item: ItemDraft, useUnit: boolean) =>
  useUnit && item.unitCents !== null && item.amountCents > 0 && item.quantity * item.unitCents !== item.amountCents ? item.quantity * item.unitCents : item.amountCents;

/**
 * The receipt's items, plus whether they add up to the total (within RM 0.05, allowing for printed rounding, tax, and
 * service charge). Returns an empty list when the receipt is unpaid, has no total, or the lines read are more than
 * 40% away from the total. A smaller gap keeps the items and marks them `incomplete`. When a line's printed amount
 * disagrees with its own "qty × unit", the reading that makes the receipt add up is used. The total is never changed.
 */
export function extractItems(text: string, pages: readonly OcrPage[] | undefined, totalAmount: number | null): { items: ReceiptItem[]; incomplete: boolean } {
  if (totalAmount === null || totalAmount <= 0 || isUnpaidDocument(text)) return { items: [], incomplete: false };
  const rows = receiptRows(pages);
  const source = rows.length ? rows : text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const read = readItems(source);
  const total = Math.round(totalAmount * 100);
  const adjustments = adjustmentCents(source);
  const matches = (sum: number) => Math.abs(sum - total) <= TOLERANCE_CENTS || Math.abs(sum + adjustments - total) <= TOLERANCE_CENTS;
  const sumOf = (list: readonly ItemDraft[], useUnit: boolean) => list.reduce((sum, item) => sum + lineCents(item, useUnit), 0);
  // Readings in order of preference: printed amounts, then each line's own "qty × unit"; computed lines are tried
  // first included, then left out. The first reading that adds up wins; otherwise printed amounts without them.
  const printed = read.filter((item) => !item.computed);
  const readings = [[read, false], [read, true], [printed, false], [printed, true]] as const;
  const [drafts, useUnit] = readings.find(([list, unit]) => matches(sumOf(list, unit))) ?? [printed, false];
  if (!drafts.some((item) => item.amountCents > 0)) return { items: [], incomplete: false };
  const sum = sumOf(drafts, useUnit);
  if (Math.abs(sum - total) > total * PLAUSIBLE_SHARE) return { items: [], incomplete: false };

  const items = drafts.map((item) => {
    const amountCents = lineCents(item, useUnit);
    const unitShown = item.unitCents !== null && item.quantity * item.unitCents === amountCents;
    // A printed "qty × unit" that disagrees with the amount leaves the quantity unverified, so it is not shown.
    const quantity = item.unitCents === null || unitShown ? item.quantity : 1;
    return { name: item.name, quantity, unitPrice: unitShown ? toAmount(item.unitCents!) : null, amount: toAmount(amountCents) };
  });
  return { items, incomplete: !matches(sum) };
}

/** The endpoint's response: the parser's fields unchanged, plus `items`, and the items warning when they may be incomplete. */
export function withReceiptItems(result: ReceiptResult, pages?: readonly OcrPage[]): ReceiptResult & { items: ReceiptItem[] } {
  const { items, incomplete } = extractItems(result.rawText, pages, result.totalAmount);
  return { ...result, warnings: incomplete ? [...result.warnings, ITEMS_INCOMPLETE] : result.warnings, items };
}
