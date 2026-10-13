// Shared locations for the receipt evaluation scripts. Everything under local-data/ is ignored by Git.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = join('local-data', 'receipt-eval');
export const IMAGES = join(ROOT, 'images');
export const OCR = join(ROOT, 'ocr');
export const LABELS = join(ROOT, 'labels.csv');
export const TEMPLATE = join('scripts', 'receipt-labels.template.csv');

const SUPPORTED = /\.(jpe?g|png|webp)$/i;
const IGNORED = /^(\..*|desktop\.ini|thumbs\.db)$/i;

/** Receipt images Vision and the app accept, plus other files that will be skipped (for example iPhone HEIC). */
export function listImages(): { images: string[]; unsupported: string[] } {
  const files = readdirSync(IMAGES, { withFileTypes: true }).filter((entry) => entry.isFile() && !IGNORED.test(entry.name)).map((entry) => entry.name).sort();
  return { images: files.filter((file) => SUPPORTED.test(file)), unsupported: files.filter((file) => !SUPPORTED.test(file)) };
}
