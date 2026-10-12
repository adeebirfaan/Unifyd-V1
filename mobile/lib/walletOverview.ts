import type { CategorySpending } from '@/lib/budgetSummary';

/**
 * Presentation view-model for the Wallet home. It only composes values that the existing
 * calculations (`calculateBudgetSummary`, subscriptions, split bills) already produce; it never
 * changes a total, invents a category, or mixes split-bill amounts into spending.
 */
export type BudgetStatus = 'noBudget' | 'healthy' | 'near' | 'over';
/** At or above this share of the budget, the overview and attention items say so. */
export const NEAR_BUDGET_PERCENT = 80;
export const TOP_CATEGORY_LIMIT = 3;
export const ATTENTION_LIMIT = 2;
export const RENEWAL_ATTENTION_DAYS = 7;

type BudgetFigures = { budgetCents: number | null; spentCents: number; balanceCents: number | null; percentageUsed: number | null };

export function budgetStatus(summary: BudgetFigures): BudgetStatus {
  if (summary.budgetCents === null || summary.percentageUsed === null || summary.balanceCents === null) return 'noBudget';
  if (summary.balanceCents < 0) return 'over';
  return summary.percentageUsed >= NEAR_BUDGET_PERCENT ? 'near' : 'healthy';
}

/** Share of the budget used, clamped to 0–1 for drawing the ring. The text still shows the real percentage. */
export function usageFraction(summary: BudgetFigures): number | null {
  return summary.percentageUsed === null ? null : Math.max(0, Math.min(1, summary.percentageUsed / 100));
}

/** The largest categories first (ties keep the fixed category order), plus how much the rest adds up to. */
export function topCategories(categories: readonly CategorySpending[], limit = TOP_CATEGORY_LIMIT) {
  const sorted = [...categories].filter((entry) => entry.cents > 0).sort((a, b) => b.cents - a.cents);
  const rest = sorted.slice(limit);
  return { top: sorted.slice(0, limit), restCount: rest.length, restCents: rest.reduce((sum, entry) => sum + entry.cents, 0) };
}

export type AttentionItem =
  | { kind: 'overBudget'; overCents: number }
  | { kind: 'nearBudget'; percent: number }
  | { kind: 'renewals'; count: number; nextName: string; nextDays: number }
  | { kind: 'owed'; cents: number };

/**
 * Up to two actionable, factual items, highest priority first: over budget, close to budget,
 * renewals due within 7 days (including dates that have passed), then money still owed in split bills.
 * Returns nothing when there is nothing to act on, so the card can be left out.
 */
export function attentionItems(input: {
  summary: BudgetFigures;
  /** Active renewals due within 7 days (including passed dates), nearest first, as `upcomingRenewals` returns them. */
  renewals: readonly { name: string; days: number }[] | null;
  owedCents: number | null;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  const status = budgetStatus(input.summary);
  if (status === 'over') items.push({ kind: 'overBudget', overCents: -(input.summary.balanceCents ?? 0) });
  if (status === 'near') items.push({ kind: 'nearBudget', percent: input.summary.percentageUsed ?? 0 });
  const next = input.renewals?.[0];
  if (next) items.push({ kind: 'renewals', count: input.renewals!.length, nextName: next.name, nextDays: next.days });
  if (input.owedCents !== null && input.owedCents > 0) items.push({ kind: 'owed', cents: input.owedCents });
  return items.slice(0, ATTENTION_LIMIT);
}

/** Donut segments as start/length fractions of the full circle, in drawing order. */
export function donutSegments(categories: readonly CategorySpending[]): { category: CategorySpending['category']; start: number; length: number }[] {
  const total = categories.reduce((sum, entry) => sum + Math.max(0, entry.cents), 0);
  if (!total) return [];
  let start = 0;
  return [...categories].filter((entry) => entry.cents > 0).sort((a, b) => b.cents - a.cents).map((entry) => {
    const length = entry.cents / total;
    const segment = { category: entry.category, start, length };
    start += length;
    return segment;
  });
}
