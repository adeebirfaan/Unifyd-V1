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

function extractAmount(lines: string[]): { value: number | null; needsReview: boolean } {
  // Prefer a labelled payable total. Subtotals, tax and change are never used as fallbacks.
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]!;
    if (!/\b(grand\s*total|total\s*(?:due|payable|amount)?|amount\s*due|jumlah(?:\s*bayaran)?)\b/i.test(line)
      || /\b(sub\s*total|subtotal|tax|sst|change|baki)\b/i.test(line)) continue;
    // Vision often places the payable amount on the line below its label.
    // Only use that line when it contains an amount alone, so another field
    // cannot accidentally become the total.
    const next = lines[index + 1];
    const sources = [line, /^(?:RM\s*)?\d[\d,]*(?:\.\d{2})?(?:\s*\/[=-]?)?\s*$/i.test(next ?? '') ? next! : null];
    for (const source of sources) {
      if (!source) continue;
      const decimals = [...source.matchAll(/(?:RM\s*)?(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})\b/gi)];
      const decimal = decimals.at(-1);
      if (decimal) {
        const value = Number(`${decimal[1]!.replaceAll(',', '')}.${decimal[2]}`);
        if (value > 0 && Number.isFinite(value)) return { value, needsReview: false };
      }
      // Handwritten receipts may write RM88 as "88/=". Treat an integer
      // only next to a total label as a draft and explicitly ask for review.
      const integer = source.match(/(?:^|[\s:])(?:RM\s*)?(\d{1,3}(?:,\d{3})*|\d+)(?:\s*\/[=-]?)?\s*$/i);
      if (integer) {
        const value = Number(integer[1]!.replaceAll(',', ''));
        if (value > 0 && Number.isFinite(value)) return { value, needsReview: true };
      }
    }
  }
  return { value: null, needsReview: true };
}

function extractMerchant(lines: string[]): string | null {
  const first = lines.findIndex((line) => /[\p{L}]/u.test(line) && !/^(receipt|resit|invoice|tax invoice|date|tarikh)\b/i.test(line));
  if (first < 0) return null;
  const prefix = lines[first]!;
  if (!/^M\/S\.?$/i.test(prefix)) return prefix;
  const name = lines[first + 1];
  if (!name || !/^[\p{L}][\p{L} .'-]*$/u.test(name) || /^(?:no|date|tarikh|quantity|amount)\b/i.test(name)) return prefix;
  const continuation = lines[first + 2];
  return `${prefix} ${name}${continuation && /^(?:BT\.?|BINTI|BIN|SDN\.?|BHD\.?)(?:\s|$)/i.test(continuation) ? ` ${continuation}` : ''}`;
}

export function parseReceiptText(rawText: string): ReceiptResult {
  const text = rawText.trim();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const merchantName = extractMerchant(lines);
  const purchaseDate = extractDate(text);
  const amount = extractAmount(lines);
  const totalAmount = amount.value;
  const warnings: string[] = [];
  if (!text) warnings.push('No readable text was detected.');
  if (!merchantName) warnings.push('Merchant name needs review.');
  if (!purchaseDate) warnings.push('Purchase date needs review.');
  if (amount.needsReview) warnings.push('Total amount needs review.');
  return { merchantName, purchaseDate, totalAmount, rawText: text, warnings };
}
