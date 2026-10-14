// Text and JSON reports for scripts/receipt-eval.ts. Pure: the caller loads the receipts. The final test set is
// requested through `loadFinal` only for a --final report, so a normal run never reads, scores, or prints it.

import { BREAKDOWN_KINDS, FIELDS, groupBy, summarize, warningBreakdown } from './receipt-eval.js';
import type { Field, GroupStats, ReceiptLabel, ScoredReceipt, WarningBreakdown } from './receipt-eval.js';

export type LoadedSet = { labels: ReceiptLabel[]; pending: string[]; missing: string[]; scored: ScoredReceipt[] };
export type ReportOptions = { final: boolean; json: boolean };

/** The final set is incomplete, so the one --final run would not give a full score. Nothing is printed. */
export class FinalSetNotReadyError extends Error {}

const report = (receipts: ScoredReceipt[]) => ({
  overall: summarize(receipts),
  byType: Object.fromEntries([...groupBy(receipts, (r) => r.label.type)].map(([key, group]) => [key, summarize(group)])),
  byCondition: Object.fromEntries([...groupBy(receipts, (r) => r.label.condition)].map(([key, group]) => [key, summarize(group)])),
});
const breakdowns = (receipts: ScoredReceipt[]) => Object.fromEntries(FIELDS.map((field) => [field, warningBreakdown(receipts, field)])) as Record<Field, WarningBreakdown>;
const finalReport = (receipts: ScoredReceipt[]) => ({ ...report(receipts), warnings: breakdowns(receipts) });

const row = (name: string, stats: GroupStats) => [
  name.padEnd(16), String(stats.count).padStart(3),
  ...FIELDS.map((field) => `${stats.fields[field].accuracy.toFixed(1).padStart(6)}%`),
  `${stats.allCorrectRate.toFixed(1).padStart(6)}%`,
  String(FIELDS.reduce((sum, field) => sum + stats.fields[field].silent, 0)).padStart(7),
].join('  ');

const BREAKDOWN_HEADINGS: Record<(typeof BREAKDOWN_KINDS)[number], string> = {
  correctNoWarning: 'correct, no warning', correctWithWarning: 'correct, warned', wrongFlagged: 'wrong, flagged', wrongSilent: 'wrong, silent', blank: 'blank',
};

function finalScored(main: LoadedSet, loadFinal: () => LoadedSet): { heldOut: ScoredReceipt[]; finalSet: LoadedSet } {
  const finalSet = loadFinal();
  if (!finalSet.labels.length) throw new FinalSetNotReadyError('The final set has no labelled receipts yet. Run "npm run eval:receipts:final-check".');
  if (finalSet.pending.length || finalSet.missing.length) {
    throw new FinalSetNotReadyError(`The final set is not complete (${finalSet.pending.length} waiting for labels, ${finalSet.missing.length} without cached OCR). Run "npm run eval:receipts:final-check" until it says OK.`);
  }
  return { heldOut: main.scored.filter((receipt) => receipt.split === 'test'), finalSet };
}

export function receiptEvalReport(options: ReportOptions, main: LoadedSet, loadFinal: () => LoadedSet): string {
  const dev = main.scored.filter((receipt) => receipt.split === 'dev');
  const test = main.scored.filter((receipt) => receipt.split === 'test');
  // Everything that can stop a final run happens before any output is built.
  const final = options.final ? finalScored(main, loadFinal) : null;
  const combined = final ? [...final.heldOut, ...final.finalSet.scored] : [];

  if (options.json) {
    return JSON.stringify({
      labelled: main.labels.length, waitingForLabels: main.pending.length, missingOcr: main.missing, dev: report(dev),
      ...(final ? { test: finalReport(final.heldOut), finalSet: finalReport(final.finalSet.scored), combined: finalReport(combined) } : {}),
    }, null, 2);
  }

  const out: string[] = [];
  const table = (title: string, receipts: ScoredReceipt[]) => {
    const { overall, byType, byCondition } = report(receipts);
    out.push(`\n${title}`);
    out.push(['group'.padEnd(16), '  n', 'merchant', '   date', '  total', ' all 3', ' silent'].join('  '));
    out.push(row('overall', overall));
    for (const [key, stats] of Object.entries(byType)) out.push(row(`  ${key}`, stats));
    for (const [key, stats] of Object.entries(byCondition)) out.push(row(`  ${key}`, stats));
  };
  const warningsTable = (receipts: ScoredReceipt[]) => {
    const widths = BREAKDOWN_KINDS.map((kind) => BREAKDOWN_HEADINGS[kind].length);
    out.push(`  warnings (receipts per field)\n  ${'field'.padEnd(10)}  ${BREAKDOWN_KINDS.map((kind, index) => BREAKDOWN_HEADINGS[kind].padStart(widths[index]!)).join('  ')}`);
    for (const field of FIELDS) {
      const counts = warningBreakdown(receipts, field);
      out.push(`  ${field.padEnd(10)}  ${BREAKDOWN_KINDS.map((kind, index) => String(counts[kind]).padStart(widths[index]!)).join('  ')}`);
    }
  };

  out.push(`\n${main.labels.length} labelled receipts: ${dev.length} development, ${test.length} held-out test${main.missing.length ? `, ${main.missing.length} without cached OCR` : ''}${main.pending.length ? `; ${main.pending.length} still waiting for labels` : ''}.`);
  if (main.missing.length) out.push(`Run "npm run eval:receipts:ocr" for: ${main.missing.join(', ')}`);
  table('DEVELOPMENT SPLIT', dev);
  if (final) {
    table(`HELD-OUT TEST SPLIT (final score, ${final.heldOut.length} receipts)`, final.heldOut);
    warningsTable(final.heldOut);
    table(`FINAL TEST SET (final score, ${final.finalSet.scored.length} receipts)`, final.finalSet.scored);
    warningsTable(final.finalSet.scored);
    table(`HELD-OUT + FINAL COMBINED (final score, ${combined.length} receipts)`, combined);
    warningsTable(combined);
  } else out.push(`\nThe ${test.length} held-out receipts are hidden. Use --final only when reporting the final result.`);

  // Wrong fields are listed for the development split only, so the held-out and final receipts stay unseen.
  const wrong = dev.filter((receipt) => FIELDS.some((field) => receipt.outcomes[field] !== 'correct'));
  if (wrong.length) {
    out.push('\nWRONG FIELDS (development split)  [silent = wrong with no review warning]');
    for (const receipt of wrong) {
      const want = { merchant: receipt.label.merchant, date: receipt.label.date, total: receipt.label.total };
      const details = FIELDS.filter((field) => receipt.outcomes[field] !== 'correct')
        .map((field) => `${field} ${receipt.outcomes[field]}: want ${JSON.stringify(want[field])}, got ${JSON.stringify(receipt.got[field])}`);
      out.push(`  ${receipt.label.file} (${receipt.label.type}, ${receipt.label.condition})\n    ${details.join('\n    ')}`);
    }
  }
  return out.join('\n');
}
