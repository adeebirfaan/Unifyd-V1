// Shared locations for the receipt evaluation scripts. Everything under local-data/ is ignored by Git.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = join('local-data', 'receipt-eval');
export const IMAGES = join(ROOT, 'images');
export const OCR = join(ROOT, 'ocr');
export const LABELS = join(ROOT, 'labels.csv');
export const TEMPLATE = join('scripts', 'receipt-labels.template.csv');

export type EvalSetPaths = { name: 'main' | 'final'; root: string; images: string; ocr: string; labels: string };
/** The development and held-out receipts used by every normal run. */
export const MAIN_SET: EvalSetPaths = { name: 'main', root: ROOT, images: IMAGES, ocr: OCR, labels: LABELS };
// The untouched final test set. Only the final-setup, final-check, and --final commands open this folder.
const FINAL_ROOT = join(ROOT, 'final');
export const FINAL_SET: EvalSetPaths = { name: 'final', root: FINAL_ROOT, images: join(FINAL_ROOT, 'images'), ocr: join(FINAL_ROOT, 'ocr'), labels: join(FINAL_ROOT, 'labels.csv') };

const SUPPORTED = /\.(jpe?g|png|webp)$/i;
const IGNORED = /^(\..*|desktop\.ini|thumbs\.db)$/i;

/** Receipt images Vision and the app accept, plus other files that will be skipped (for example iPhone HEIC). */
export function listImages(folder = IMAGES): { images: string[]; unsupported: string[] } {
  const files = readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile() && !IGNORED.test(entry.name)).map((entry) => entry.name).sort();
  return { images: files.filter((file) => SUPPORTED.test(file)), unsupported: files.filter((file) => !SUPPORTED.test(file)) };
}
