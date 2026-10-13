// Merchant (trading name) extraction for receipts. Pure functions, used by receipt-parser.ts.

import { KNOWN_MERCHANTS } from './receipt-merchants.js';

export type Extracted<T> = { value: T | null; review: boolean };

/** Lowercase letters and digits only, so "MR. D. I.Y." and "mr diy" compare equal. */
const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
const tokensOf = (text: string) => text.toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9&]+/).filter(Boolean).map((token) => token.replace(/&/g, ''));

export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length]!;
}

// Petrol stations print the dealer's company at the top, so a fuel brand anywhere on the receipt is the merchant.
const FUEL_BRANDS = new Set(['Petronas', 'Shell', 'Petron', 'Caltex', 'BHPetrol']);
const MERCHANT_ALIASES = KNOWN_MERCHANTS.map((merchant) => ({
  name: merchant.name,
  aliases: (merchant.aliases ?? [merchant.name]).map((alias) => ({ squashed: squash(alias), tokens: tokensOf(alias) })),
}));

/** A known brand named in the text. Long names may sit inside other text ("al-ikhsansPORTS"); short ones must be whole words. */
export function brandInText(text: string): string | null {
  const squashed = squash(text);
  const tokens = tokensOf(text);
  for (const merchant of MERCHANT_ALIASES) {
    for (const alias of merchant.aliases) {
      if (alias.squashed.length >= 5 ? squashed.includes(alias.squashed)
        : tokens.some((_, index) => alias.tokens.every((token, offset) => tokens[index + offset] === token))) return merchant.name;
    }
  }
  return null;
}

/**
 * A known brand misread at the start of a header line ("99 SPEED WART"). Only names of six or more letters are
 * compared, within one edit (two for ten or more), so short or unrelated words never snap to a brand.
 */
function brandNearText(text: string): string | null {
  const squashed = squash(text);
  for (const merchant of MERCHANT_ALIASES) {
    for (const alias of merchant.aliases) {
      if (alias.squashed.length < 6 || squashed.length < alias.squashed.length) continue;
      if (editDistance(squashed.slice(0, alias.squashed.length), alias.squashed) <= (alias.squashed.length >= 10 ? 2 : 1)) return merchant.name;
    }
  }
  return null;
}

const AMOUNT = /\d+[.,]\d{2}\b/;
const BARCODE = /\d{8,}/;
const NUMERIC_DATE = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b|\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/;
// The header ends where the purchase details begin: a date, an amount, a barcode, or a column/field label.
const HEADER_END = /\b(date|tarikh|cashier|kasir|table|order\s*(?:no|#|details)|qty|item|invoice\s*no|receipt\s*no|bill\s*no)\b/i;
const NOT_A_NAME = [
  /^(tax\s*)?(invoice|receipt|resit|bill|cash\s*bill|official\s*receipt|checked|copy|reprint|duplicate|welcome|thank)\b/i,
  /\b(tel|fax|phone|h\/?p|reg|gst|sst|co\.?\s*no|company\s*no|ssm|brn|registration|lot|jalan|jln|lorong|taman|tmn|level|floor|plaza|kompleks|complex|mall|mukim|kg|kampung)\b/i,
  /www\.|https?:|\.com\b|\.my\b|@/i,
  /\*{2,}|\brm\s?\d|%|\b(promo|promotion|sale|offer|discount|voucher|free|deal)\b/i,
  /\b\d{5}\b|\d{1,2}:\d{2}/,
  /^[^(]*\)\s*$|^\(.*\)$/, // a bracketed fragment such as a cashier name "RAFIQAH)" or a company number
];
const BUSINESS_WORD = /\b(sdn\.?\s*bhd|bhd|berhad|enterprise|trading|plt|restoran|restaurant|kedai|pasaraya|supermarket|hypermarket|mart|store|stores|cafe|bakery|pharmacy|farmasi|hardware|perniagaan|koperasi|station|bookstore|bookshop|kopitiam|bistro)\b/i;
const FOOTER_NAME = /\b(?:shopping|shop|visiting|dining|belanja|membeli-belah)\s+(?:at|with|di)\b[\s:-]*(.*)$|\b(?:welcome\s+to|selamat\s+datang\s+ke)\b[\s:-]*(.*)$/i;

const letterCount = (line: string) => (line.match(/\p{L}/gu) ?? []).length;
const digitCount = (line: string) => (line.match(/\d/g) ?? []).length;
const looksLikeName = (line: string) => letterCount(line) >= 3 && digitCount(line) < letterCount(line) && !AMOUNT.test(line) && !NOT_A_NAME.some((pattern) => pattern.test(line));
/** Removes company registration numbers: long digit runs and bracketed forms such as "(805614-T)" or "(1425272-D)". */
const withoutRegistration = (line: string) => line.replace(/\(\s*\d[\d\s-]*[A-Z]?\s*\)|\b\d{6,}\b/g, ' ').replace(/\s+/g, ' ').trim();
const cleanName = (name: string) => name.replace(/^[\s:*.,!-]+|[\s:*.,!-]+$/g, '');

/** Do two names start with the same word, allowing one misread letter in words of five or more letters? */
function sameFirstWord(a: string, b: string): boolean {
  const [x] = tokensOf(a);
  const [y] = tokensOf(b);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 5 && editDistance(x, y) <= 1);
}

/**
 * The trading name, with `review` when it is not well supported. In order:
 * 1. a known brand in the header (exact);
 * 2. the name in "THANK YOU FOR SHOPPING AT X" / "WELCOME TO X" (review unless the header supports it);
 * 3. a fuel brand anywhere (review when it is not in the header);
 * 4. a known brand misread in the header (review);
 * 5. the first header line that reads as a business name, or that a company line just below supports;
 * 6. another known brand elsewhere on the receipt (review);
 * 7. the first header line that merely looks like a name (review), otherwise nothing.
 */
export function extractMerchant(lines: readonly string[]): Extracted<string> {
  const headerEnd = lines.findIndex((line, index) => index > 0 && (NUMERIC_DATE.test(line) || AMOUNT.test(line) || BARCODE.test(line) || HEADER_END.test(line)));
  const header = lines.slice(0, Math.min(headerEnd < 0 ? lines.length : headerEnd, 8));
  // Logos are often split over two lines ("UNI" / "QLO"), so neighbouring lines are also read together.
  const headerTexts = [...header, ...header.slice(1).map((line, index) => `${header[index]}${line}`)];
  for (const text of headerTexts) {
    const brand = brandInText(text);
    if (brand) return { value: brand, review: false };
  }

  let candidate: string | null = null;
  let confident = false;
  for (let index = 0; index < header.length && !candidate; index += 1) {
    const line = header[index]!;
    if (/^M\/S\.?$/i.test(line)) {
      // Handwritten bills: "M/S" followed by the shop name, sometimes with "BT."/"BIN" on the next line.
      const name = lines[index + 1];
      if (name && /^[\p{L}][\p{L} .'-]*$/u.test(name) && !/^(?:no|date|tarikh|quantity|amount)\b/i.test(name)) {
        const continuation = lines[index + 2];
        candidate = `${line} ${name}${continuation && /^(?:BT\.?|BINTI|BIN|SDN\.?|BHD\.?)(?:\s|$)/i.test(continuation) ? ` ${continuation}` : ''}`;
        confident = true;
      }
      continue;
    }
    // Company registration numbers are often printed on the name line ("NINSO GLOBAL SDN BHD 200801004330 (805614-T)").
    const name = withoutRegistration(line);
    if (!looksLikeName(name)) continue;
    candidate = name;
    confident = BUSINESS_WORD.test(name) || header.slice(index + 1, index + 4).some((next) => BUSINESS_WORD.test(next) && sameFirstWord(name, next));
  }

  for (let index = 0; index < lines.length; index += 1) {
    const match = FOOTER_NAME.exec(lines[index]!);
    if (!match) continue;
    let name = cleanName(match[1] ?? match[2] ?? '');
    if (!name && lines[index + 1] && looksLikeName(lines[index + 1]!)) name = cleanName(lines[index + 1]!);
    if (letterCount(name) < 3 || /^(us|our)\b/i.test(name)) continue;
    const brand = brandInText(name);
    if (brand) return { value: brand, review: false };
    return { value: name, review: !header.some((line) => sameFirstWord(line, name)) };
  }

  const elsewhere = lines.filter((line) => !AMOUNT.test(line) && !BARCODE.test(line)).map(brandInText).filter((brand): brand is string => !!brand);
  const fuel = elsewhere.find((brand) => FUEL_BRANDS.has(brand));
  if (fuel) return { value: fuel, review: true };
  for (const text of headerTexts) {
    const near = brandNearText(text);
    if (near) return { value: near, review: true };
  }
  if (candidate && confident) return { value: candidate, review: false };
  if (elsewhere[0]) return { value: elsewhere[0], review: true };
  return { value: candidate, review: true };
}
