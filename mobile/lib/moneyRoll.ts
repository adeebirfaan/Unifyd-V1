/**
 * Odometer columns for rolling one formatted amount (for example "1,234.50") into another.
 * Columns align from the right so units, cents, and separators stay in place. The result always
 * has the target's length, so the layout is final from the first frame. Each column lists the
 * characters it passes through, from the previous character to the target one.
 */
export function rollColumns(fromText: string, toText: string, increasing: boolean): string[][] {
  return Array.from(toText, (target, index) => {
    const previous = fromText[fromText.length - (toText.length - index)] ?? ' ';
    if (previous === target) return [target];
    if (!isDigit(previous) || !isDigit(target)) return [previous, target];
    // Pass through the in-between digits, upwards for a rising total and downwards for a falling one.
    const step = increasing ? 1 : 9;
    const sequence = [previous];
    for (let digit = Number(previous); String(digit) !== target;) {
      digit = (digit + step) % 10;
      sequence.push(String(digit));
    }
    return sequence;
  });
}

function isDigit(char: string) {
  return char >= '0' && char <= '9';
}

/** The amount after the "RM " prefix, matching `formatRinggit` (en-MY, two decimals, thousands separators). */
export function amountDigits(cents: number): string {
  const formatted = new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100);
  return cents < 0 ? `-${formatted}` : formatted;
}
