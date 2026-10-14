// Format check for the final test set's labels.csv. It reads only the labels and the folder listing: it never
// runs the parser or opens cached OCR text, so checking labels cannot reveal how the parser does on the set.

import { RECEIPT_CONDITIONS, RECEIPT_TYPES, readLabelsCsv } from './receipt-eval.js';

export type LabelCheck = {
  errors: string[];
  labelled: number;
  pending: string[];
  /** Rows whose file is not in the images folder. */
  unknownFiles: string[];
  /** Images with no row in labels.csv. */
  unlistedImages: string[];
  unsupported: string[];
  /** How many labelled images have cached OCR (a count only; the text is never read). */
  cached: number;
  byType: Record<string, number>;
  byCondition: Record<string, number>;
};

export function checkLabels(csv: string, folder: { images: string[]; unsupported: string[]; cached: ReadonlySet<string> }): LabelCheck {
  const { labels, pending, errors, files: listed } = readLabelsCsv(csv);
  const count = (values: string[], keys: readonly string[]) => Object.fromEntries(keys.map((key) => [key, values.filter((value) => value === key).length]));
  return {
    errors,
    labelled: labels.length,
    pending,
    unknownFiles: listed.filter((file) => !folder.images.includes(file)),
    unlistedImages: folder.images.filter((file) => !listed.includes(file)),
    unsupported: folder.unsupported,
    cached: labels.filter((label) => folder.cached.has(label.file)).length,
    byType: count(labels.map((label) => label.type), RECEIPT_TYPES),
    byCondition: count(labels.map((label) => label.condition), RECEIPT_CONDITIONS),
  };
}

/** Ready for the one --final run: no errors, every image labelled, and every label with cached OCR. */
export const labelsReady = (check: LabelCheck) => !check.errors.length && !check.pending.length && !check.unknownFiles.length
  && !check.unlistedImages.length && check.labelled > 0 && check.cached === check.labelled;

export function formatLabelCheck(check: LabelCheck, labelsPath: string): string {
  const out = [`Checked server/${labelsPath} (format only; the parser is not run).`];
  out.push(`${check.labelled} labelled, ${check.pending.length} waiting for labels, ${check.cached} of ${check.labelled} with cached OCR.`);
  const list = (title: string, items: string[]) => { if (items.length) out.push(`${title}:`, ...items.map((item) => `  ${item}`)); };
  list('Problems', check.errors);
  list('Waiting for labels', check.pending);
  list('In labels.csv but not in the images folder', check.unknownFiles);
  list('In the images folder but not in labels.csv (run "npm run eval:receipts:final-setup")', check.unlistedImages);
  list('Skipped files (save as JPEG, PNG, or WEBP)', check.unsupported);
  if (check.labelled) {
    out.push(`Types: ${Object.entries(check.byType).map(([key, value]) => `${key} ${value}`).join(', ')}`);
    out.push(`Conditions: ${Object.entries(check.byCondition).map(([key, value]) => `${key} ${value}`).join(', ')}`);
  }
  if (check.labelled && check.cached < check.labelled) out.push('Some labelled images have no cached OCR yet: run "npm run eval:receipts:final-setup".');
  out.push(labelsReady(check) ? 'Labels OK: the final set is ready for the one --final run.' : 'Not ready yet: fix the items above and run this check again.');
  return out.join('\n');
}
