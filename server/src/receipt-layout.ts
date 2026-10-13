// Rebuilds a receipt's printed rows from Vision word boxes. Vision often reads a two-column receipt
// column by column ("Total", "Cash", "Change", then "46.30", "50.00", "3.70"), so the text order alone
// cannot pair a label with its amount. Words that sit on the same printed row can.

import type { OcrPage, OcrWord } from './timetable-parser.js';

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

/**
 * The text's slope (dy/dx), from neighbouring words Vision reads one after another on the same line, so a
 * receipt photographed at an angle still groups into straight rows.
 */
function skew(words: readonly OcrWord[], height: number): number {
  const slopes: number[] = [];
  for (let index = 1; index < words.length; index += 1) {
    const a = words[index - 1]!;
    const b = words[index]!;
    const dx = (b.x0 + b.x1) / 2 - (a.x0 + a.x1) / 2;
    const dy = (b.y0 + b.y1) / 2 - (a.y0 + a.y1) / 2;
    if (b.x0 >= a.x1 - height * 0.2 && b.x0 - a.x1 < height * 3 && Math.abs(dy) < height * 0.8 && dx > 0) slopes.push(dy / dx);
  }
  return slopes.length >= 5 ? median(slopes) : 0;
}

/**
 * Printed rows, top to bottom, each with its words left to right joined by spaces. Returns an empty list when
 * there are no word boxes (text-only callers), so the parser falls back to the text order.
 */
export function receiptRows(pages: readonly OcrPage[] | undefined): string[] {
  const words = (pages ?? []).flatMap((page) => page.words).filter((word) => word.text.trim() && word.y1 > word.y0);
  if (words.length < 2) return [];
  const height = median(words.map((word) => word.y1 - word.y0)) || 1;
  const slope = skew(words, height);
  const placed = words.map((word) => ({ word, x: (word.x0 + word.x1) / 2, y: (word.y0 + word.y1) / 2 - slope * ((word.x0 + word.x1) / 2) }))
    .sort((a, b) => a.y - b.y);
  const rows: { y: number; items: typeof placed }[] = [];
  for (const item of placed) {
    // Same row when the straightened centres are within about half a text height.
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= height * 0.55);
    if (row) {
      row.items.push(item);
      row.y = row.items.reduce((sum, entry) => sum + entry.y, 0) / row.items.length;
    } else rows.push({ y: item.y, items: [item] });
  }
  return rows.sort((a, b) => a.y - b.y).map((row) => row.items.sort((a, b) => a.x - b.x).map((entry) => entry.word.text).join(' '));
}
