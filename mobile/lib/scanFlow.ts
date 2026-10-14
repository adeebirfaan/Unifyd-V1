// Rules for the three-step receipt scan flow (Start → Reading → Review). Pure, so Node tests can run them.

/** The Reading state stays visible at least this long, so a fast result never flickers. */
export const READING_MIN_MS = 1200;
/** After this long without a result, Reading offers Retry and Enter manually. */
export const READING_SLOW_MS = 20000;

/** How much longer to keep Reading on screen before showing a result that arrived `now`. Never an extra delay. */
export function remainingMinimumMs(startedAt: number, now: number, minimum = READING_MIN_MS): number {
  return Math.max(0, startedAt + minimum - now);
}

export type ReviewField = 'merchant' | 'date' | 'total';
export const REVIEW_FIELDS: readonly ReviewField[] = ['merchant', 'date', 'total'];
export type ReviewFlags = { fields: Record<ReviewField, boolean>; noText: boolean; other: boolean };

// The server's exact warning strings (receipt-parser.ts). Nothing is inferred beyond them.
const WARNING_FIELD: Record<string, ReviewField> = {
  'Merchant name needs review.': 'merchant',
  'Purchase date needs review.': 'date',
  'Total amount needs review.': 'total',
};
const NO_TEXT = 'No readable text was detected.';

/** Which Details fields to mark "Check", from the receipt endpoint's warnings. */
export function reviewFlags(warnings: readonly string[]): ReviewFlags {
  const fields: Record<ReviewField, boolean> = { merchant: false, date: false, total: false };
  let noText = false;
  let other = false;
  for (const warning of warnings) {
    const field = WARNING_FIELD[warning];
    if (field) fields[field] = true;
    else if (warning === NO_TEXT) noText = true;
    else other = true;
  }
  return { fields, noText, other };
}

/** An editable draft amount: two decimals, or empty when nothing was detected. */
export function draftAmount(amount: number | null): string {
  return amount !== null && Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : '';
}

/**
 * A receipt line returned by the server (Phase C, optional `items` field). `amount` is the line total in RM;
 * a negative amount is a discount. Items help the student check the total; they are never saved.
 */
export type ReceiptItem = { name: string; quantity: number; amount: number };
export type DraftItem = ReceiptItem & { id: string };
/** With more items than this, the list starts collapsed. */
export const ITEMS_PREVIEW = 4;
const MAX_ITEMS = 200;

const isItem = (value: unknown): value is ReceiptItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ReceiptItem>;
  return typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 200
    && typeof item.quantity === 'number' && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 999
    && typeof item.amount === 'number' && Number.isFinite(item.amount) && item.amount !== 0 && Math.abs(item.amount) < 1e9;
};

/** The optional `items` field: a valid list, or an empty one. A malformed field never breaks the scan. */
export function receiptItems(value: unknown): ReceiptItem[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS || !value.every(isItem)) return [];
  return value.map((item) => ({ name: item.name.trim(), quantity: item.quantity, amount: Math.round(item.amount * 100) / 100 }));
}

export function draftItems(items: readonly ReceiptItem[]): DraftItem[] {
  return items.map((item, index) => ({ ...item, id: `item-${index}` }));
}

/** The rows to show: all of them when expanded or when there are few, otherwise the first `ITEMS_PREVIEW`. */
export function visibleItems<T>(items: readonly T[], expanded: boolean): readonly T[] {
  return expanded || items.length <= ITEMS_PREVIEW ? items : items.slice(0, ITEMS_PREVIEW);
}

/** Items added up in integer cents (discounts are negative). */
export function itemsTotalCents(items: readonly ReceiptItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0);
}

/** True when there are items and they do not add up to the entered total. An unreadable total is not compared. */
export function itemsMismatch(items: readonly ReceiptItem[], totalAmount: number | null): boolean {
  if (!items.length || totalAmount === null) return false;
  return itemsTotalCents(items) !== Math.round(totalAmount * 100);
}

export type ItemInput = { name: string; quantity: string; price: string };
export type ItemErrors = Partial<Record<keyof ItemInput, true>>;

/** Validates the item sheet. The price is entered as a positive amount; a discount is stored as negative. */
export function parseItemInput(input: ItemInput, discount: boolean): { item: ReceiptItem | null; errors: ItemErrors } {
  const errors: ItemErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = true;
  const quantity = discount ? 1 : Number(input.quantity.trim());
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) errors.quantity = true;
  const priceText = input.price.trim();
  const price = /^\d+(?:\.\d{1,2})?$/.test(priceText) ? Number(priceText) : NaN;
  if (!(price > 0 && price < 1e9)) errors.price = true;
  if (Object.keys(errors).length) return { item: null, errors };
  return { item: { name, quantity, amount: discount ? -price : price }, errors };
}
